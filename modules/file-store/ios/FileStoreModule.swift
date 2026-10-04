import Foundation
import React

// Replaces a community filesystem library whose JS side cost ~115 KB of
// bundle (it dragged in `buffer` and `http-status-codes`) for eight calls.
// Paths are absolute; bytes cross the bridge as base64, like ICloudDrive.

private let queue = DispatchQueue(label: Bundle.main.bundleIdentifier! + ".files", qos: .userInitiated)

@objc(FileStore)
public class FileStore: NSObject {
  @objc public static func requiresMainQueueSetup() -> Bool { false }

  @objc public func constantsToExport() -> [AnyHashable: Any]! {
    let manager = FileManager.default
    return [
      "documentDir": manager.urls(for: .documentDirectory, in: .userDomainMask)[0].path,
      "cacheDir": manager.urls(for: .cachesDirectory, in: .userDomainMask)[0].path,
    ]
  }

  @objc public func exists(
    _ path: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    queue.async { resolve(FileManager.default.fileExists(atPath: path)) }
  }

  @objc public func mkdir(
    _ path: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(reject) {
      try FileManager.default.createDirectory(atPath: path, withIntermediateDirectories: true)
      resolve(nil)
    }
  }

  @objc public func readDir(
    _ path: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(reject) {
      let keys: [URLResourceKey] = [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey]
      let urls = try FileManager.default.contentsOfDirectory(
        at: URL(fileURLWithPath: path, isDirectory: true),
        includingPropertiesForKeys: keys
      )
      resolve(urls.map { url -> [String: Any] in
        let values = try? url.resourceValues(forKeys: Set(keys))
        var entry: [String: Any] = [
          "name": url.lastPathComponent,
          "path": url.path,
          "isFile": values?.isRegularFile ?? false,
          "size": values?.fileSize ?? 0,
        ]
        if let modified = values?.contentModificationDate {
          entry["mtime"] = modified.timeIntervalSince1970 * 1000
        }
        return entry
      })
    }
  }

  @objc public func readBase64(
    _ path: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(reject) {
      resolve(try Data(contentsOf: URL(fileURLWithPath: path)).base64EncodedString())
    }
  }

  @objc public func writeBase64(
    _ path: String,
    base64: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(reject) {
      guard let data = Data(base64Encoded: base64) else {
        throw NSError(domain: "FileStore", code: 0, userInfo: [NSLocalizedDescriptionKey: "Not valid base64"])
      }
      try data.write(to: URL(fileURLWithPath: path), options: .atomic)
      resolve(nil)
    }
  }

  @objc public func remove(
    _ path: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(reject) {
      if FileManager.default.fileExists(atPath: path) {
        try FileManager.default.removeItem(atPath: path)
      }
      resolve(nil)
    }
  }

  @objc public func copy(
    _ from: String,
    to: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(reject) {
      try FileManager.default.copyItem(atPath: from, toPath: to)
      resolve(nil)
    }
  }

  @objc public func move(
    _ from: String,
    to: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    run(reject) {
      try FileManager.default.moveItem(atPath: from, toPath: to)
      resolve(nil)
    }
  }
}

// Every call is disk I/O — off the main thread, errors turned into rejections.
private func run(_ reject: @escaping RCTPromiseRejectBlock, _ work: @escaping () throws -> Void) {
  queue.async {
    do {
      try work()
    } catch {
      reject("file_error", error.localizedDescription, error)
    }
  }
}
