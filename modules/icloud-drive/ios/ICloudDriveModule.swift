import Foundation
import React

// Keys are relative paths under the container's `Documents/` — the only
// subtree iOS ever shows the user in Files, and only once the app's
// NSUbiquitousContainers marks it document-scope public.
private let documentsFolder = "Documents"

// A file can exist in the container without its bytes being on this device.
// Asking for them is a request, not a read, so reads wait for it to land.
private let downloadTimeout: TimeInterval = 60
private let downloadPollInterval: TimeInterval = 0.25

private let errorDomain = "ICloudDrive"

// Every call does disk I/O and a read may sit waiting on a download, so none
// of it belongs on the main thread.
private let queue = DispatchQueue(label: "com.solomonxie.budgetsbro.icloud", qos: .userInitiated)

// Bytes cross the bridge as base64. A plain React Native module has no
// Uint8Array to hand (that is a TurboModule spec's job, and this one call
// site does not justify codegen) — the JS side converts, and the zips this
// carries are small enough that the extra third of a copy costs nothing
// noticeable.
@objc(ICloudDrive)
public class ICloudDrive: NSObject {
  @objc public static func requiresMainQueueSetup() -> Bool { false }

  // A nil container has three different causes and the UI has to tell them
  // apart, because only one is something the user can act on.
  //
  // ubiquityIdentityToken is only meaningful once the entitlement is
  // granted — without it the token reads nil too, which is why the profile
  // is checked first. With it, the token tracks the account *and* whether
  // documents-and-data syncing is on, so a nil token means iCloud Drive is
  // unavailable to this device — the case worth giving directions for.
  @objc public func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      if documentsURL() != nil { return resolve("available") }
      if !buildGrantsICloud() { return resolve("notEntitled") }
      if FileManager.default.ubiquityIdentityToken == nil { return resolve("icloudOff") }
      // Entitled, signed in, drive on, and still nothing: a container that
      // was only just created and hasn't propagated yet.
      resolve("notReady")
    }
  }

  @objc public func getContainerPath(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async { resolve(documentsURL()?.path) }
  }

  @objc public func write(
    _ key: String,
    base64: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      do {
        guard let data = Data(base64Encoded: base64) else {
          throw failure("invalid_data", "Backup bytes were not valid base64")
        }
        let target = try resolveKey(key)
        try FileManager.default.createDirectory(
          at: target.deletingLastPathComponent(),
          withIntermediateDirectories: true
        )
        try coordinateWrite(target, data)
        resolve(nil)
      } catch {
        rejectWith(reject, error)
      }
    }
  }

  @objc public func list(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      guard let root = documentsURL() else {
        return rejectWith(reject, unavailable())
      }
      resolve(listKeys(root))
    }
  }

  @objc public func read(
    _ key: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      do {
        let target = try resolveKey(key)
        try awaitDownload(target)
        guard FileManager.default.fileExists(atPath: target.path) else { return resolve(nil) }
        resolve(try coordinateRead(target)?.base64EncodedString())
      } catch {
        rejectWith(reject, error)
      }
    }
  }

  // Coordinated, like the writes: another device may be reading this file as
  // it goes. Missing is success — pruning the same stale key twice, or
  // deleting one iCloud already removed elsewhere, is not a failure.
  @objc public func remove(
    _ key: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async {
      do {
        let target = try resolveKey(key)
        guard FileManager.default.fileExists(atPath: target.path) else { return resolve(nil) }
        try coordinateDelete(target)
        resolve(nil)
      } catch {
        rejectWith(reject, error)
      }
    }
  }
}

private func failure(_ code: String, _ message: String) -> NSError {
  NSError(domain: errorDomain, code: 0, userInfo: [
    NSLocalizedDescriptionKey: message,
    "code": code,
  ])
}

private func unavailable() -> NSError {
  failure(
    "icloud_unavailable",
    "iCloud Drive is unavailable — sign in to iCloud and turn iCloud Drive on for this app"
  )
}

private func rejectWith(_ reject: RCTPromiseRejectBlock, _ error: Error) {
  let nsError = error as NSError
  reject(nsError.userInfo["code"] as? String ?? "icloud_error", nsError.localizedDescription, error)
}

// Development and ad-hoc builds embed the profile they were signed with. If
// its entitlements grant no ubiquity container, a nil container is the
// build's doing and signing into iCloud cannot fix it — worth telling apart,
// because "sign in" sent to an already-signed-in user is a dead end. A build
// with no profile to inspect (App Store) is assumed granted: it could not
// have shipped with the capability declared and not granted.
private func buildGrantsICloud() -> Bool {
  guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
        let raw = try? Data(contentsOf: url),
        let text = String(data: raw, encoding: .isoLatin1),
        let start = text.range(of: "<?xml"),
        let end = text.range(of: "</plist>"),
        let plist = String(text[start.lowerBound..<end.upperBound]).data(using: .isoLatin1),
        let root = try? PropertyListSerialization.propertyList(from: plist, format: nil) as? [String: Any],
        let entitlements = root["Entitlements"] as? [String: Any]
  else { return true }
  return entitlements["com.apple.developer.ubiquity-container-identifiers"] != nil
}

// nil identifier means "the first container in the app's entitlements", so the
// container id lives in the entitlements file and is never repeated here.
private func documentsURL() -> URL? {
  guard let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) else { return nil }
  return container.appendingPathComponent(documentsFolder, isDirectory: true)
}

private func resolveKey(_ key: String) throws -> URL {
  guard let root = documentsURL() else { throw unavailable() }
  guard !key.isEmpty, !key.hasPrefix("/"), !key.contains("..") else {
    throw failure("invalid_key", "Not a backup key this container can hold: \(key)")
  }
  return root.appendingPathComponent(key)
}

private func listKeys(_ root: URL) -> [String] {
  let manager = FileManager.default
  guard manager.fileExists(atPath: root.path) else { return [] }
  let prefix = root.standardizedFileURL.path + "/"
  let enumerator = manager.enumerator(at: root, includingPropertiesForKeys: [.isDirectoryKey])
  var keys: [String] = []
  while let url = enumerator?.nextObject() as? URL {
    if (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true { continue }
    let path = url.standardizedFileURL.path
    guard path.hasPrefix(prefix) else { continue }
    keys.append(materializedKey(String(path.dropFirst(prefix.count))))
  }
  return keys
}

// A file not yet downloaded to this device exists only as `.<name>.icloud`.
// Callers want the name it will have once it is here, not the placeholder's.
private func materializedKey(_ key: String) -> String {
  var parts = key.split(separator: "/").map(String.init)
  guard let placeholder = parts.popLast(),
        placeholder.hasPrefix("."), placeholder.hasSuffix(".icloud") else { return key }
  let name = String(placeholder.dropFirst().dropLast(".icloud".count))
  return (parts + [name]).joined(separator: "/")
}

private func awaitDownload(_ url: URL) throws {
  let manager = FileManager.default
  if manager.fileExists(atPath: url.path) { return }
  let placeholder = url.deletingLastPathComponent()
    .appendingPathComponent("." + url.lastPathComponent + ".icloud")
  guard manager.fileExists(atPath: placeholder.path) else { return }

  try manager.startDownloadingUbiquitousItem(at: url)
  let deadline = Date().addingTimeInterval(downloadTimeout)
  while !manager.fileExists(atPath: url.path) {
    if Date() > deadline {
      throw failure("download_timeout", "Timed out waiting for iCloud to download \(url.lastPathComponent)")
    }
    Thread.sleep(forTimeInterval: downloadPollInterval)
  }
}

// NSFileCoordinator, not a bare Data.write: another device's sync daemon can
// be touching the same file, and uncoordinated access is how you get a
// half-written zip uploaded.
private func coordinateWrite(_ url: URL, _ data: Data) throws {
  var coordinationError: NSError?
  var failureError: Error?
  NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { target in
    do { try data.write(to: target, options: .atomic) } catch { failureError = error }
  }
  if let coordinationError { throw coordinationError }
  if let failureError { throw failureError }
}

private func coordinateDelete(_ url: URL) throws {
  var coordinatorError: NSError?
  var thrown: Error?
  NSFileCoordinator().coordinate(writingItemAt: url, options: .forDeleting, error: &coordinatorError) { target in
    do { try FileManager.default.removeItem(at: target) } catch { thrown = error }
  }
  if let coordinatorError { throw coordinatorError }
  if let thrown { throw thrown }
}

private func coordinateRead(_ url: URL) throws -> Data? {
  var coordinationError: NSError?
  var failureError: Error?
  var bytes: Data?
  NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { target in
    do { bytes = try Data(contentsOf: target) } catch { failureError = error }
  }
  if let coordinationError { throw coordinationError }
  if let failureError { throw failureError }
  return bytes
}
