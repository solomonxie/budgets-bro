import Foundation
import React
import StoreKit

// ISO alpha-3 App Store country ("CHN", "USA"), or nil when unknown.
// BBStorefrontOverride in Info.plist, set only by a device test build
// (`make install-ios STOREFRONT=CHN`), wins over the real storefront.
@objc(Storefront)
public class Storefront: NSObject {
  @objc public static func requiresMainQueueSetup() -> Bool { false }

  @objc public func countryCode(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    if let override = Bundle.main.object(forInfoDictionaryKey: "BBStorefrontOverride") as? String,
      !override.isEmpty
    {
      resolve(override)
      return
    }
    Task { resolve(await StoreKit.Storefront.current?.countryCode) }
  }
}
