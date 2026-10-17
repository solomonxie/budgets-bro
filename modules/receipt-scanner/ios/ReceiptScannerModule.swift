import Foundation
import PhotosUI
import React
import Vision
import VisionKit

// Shows the document camera ("camera") or the photo picker ("library"), then
// runs Vision text recognition on the image. Resolves the recognized text as
// [{text, x, y, w, h}] in 0–1 page coordinates, top-left origin, or nil if
// the user cancelled. Nothing leaves the device.
@objc(ReceiptScanner)
public class ReceiptScanner: NSObject, VNDocumentCameraViewControllerDelegate,
  PHPickerViewControllerDelegate
{
  private var resolve: RCTPromiseResolveBlock?
  private var reject: RCTPromiseRejectBlock?

  @objc public static func requiresMainQueueSetup() -> Bool { false }

  @objc public func scan(
    _ source: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard let presenter = RCTPresentedViewController() else {
        reject("no_view", "Nothing to present from", nil)
        return
      }
      self.resolve = resolve
      self.reject = reject
      if source == "camera" && VNDocumentCameraViewController.isSupported {
        let camera = VNDocumentCameraViewController()
        camera.delegate = self
        presenter.present(camera, animated: true)
      } else {
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = self
        presenter.present(picker, animated: true)
      }
    }
  }

  public func documentCameraViewController(
    _ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan
  ) {
    let image = scan.pageCount > 0 ? scan.imageOfPage(at: 0) : nil
    controller.dismiss(animated: true) { self.recognize(image) }
  }

  public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true) { self.finish(nil) }
  }

  public func documentCameraViewController(
    _ controller: VNDocumentCameraViewController, didFailWithError error: Error
  ) {
    controller.dismiss(animated: true) { self.fail(error) }
  }

  public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    guard let provider = results.first?.itemProvider, provider.canLoadObject(ofClass: UIImage.self)
    else {
      finish(nil)
      return
    }
    provider.loadObject(ofClass: UIImage.self) { object, error in
      if let error = error { self.fail(error) } else { self.recognize(object as? UIImage) }
    }
  }

  private func recognize(_ image: UIImage?) {
    guard let cgImage = image?.cgImage else {
      finish(nil)
      return
    }
    let orientation = CGImagePropertyOrientation(image!.imageOrientation)
    DispatchQueue.global(qos: .userInitiated).async {
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en-US", "zh-Hans", "fr-FR"]
      do {
        try VNImageRequestHandler(cgImage: cgImage, orientation: orientation).perform([request])
      } catch {
        self.fail(error)
        return
      }
      let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
        guard let text = observation.topCandidates(1).first?.string else { return nil }
        let box = observation.boundingBox
        return [
          "text": text, "x": box.minX, "y": 1 - box.maxY, "w": box.width, "h": box.height,
        ]
      }
      self.finish(lines)
    }
  }

  private func finish(_ value: Any?) {
    resolve?(value)
    resolve = nil
    reject = nil
  }

  private func fail(_ error: Error) {
    reject?("scan_failed", error.localizedDescription, error)
    resolve = nil
    reject = nil
  }
}

extension CGImagePropertyOrientation {
  init(_ orientation: UIImage.Orientation) {
    switch orientation {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
