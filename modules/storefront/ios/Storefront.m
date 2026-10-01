#import <React/RCTBridgeModule.h>

// The Objective-C face of StorefrontModule.swift — see ICloudDrive.m.
@interface RCT_EXTERN_MODULE (Storefront, NSObject)

RCT_EXTERN_METHOD(countryCode
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

@end
