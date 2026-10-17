#import <React/RCTBridgeModule.h>

// The Objective-C face of ReceiptScannerModule.swift — see ICloudDrive.m.
@interface RCT_EXTERN_MODULE (ReceiptScanner, NSObject)

RCT_EXTERN_METHOD(scan
                  : (NSString *)source resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

@end
