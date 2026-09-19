#import <React/RCTBridgeModule.h>

// The Objective-C face of ICloudDriveModule.swift. React Native discovers
// native modules through this macro pair; Swift alone is invisible to it.
//
// A plain bridge module rather than a TurboModule spec: the new
// architecture's interop layer runs these unchanged, and six methods moving
// strings and arrays is not worth a codegen pipeline.
@interface RCT_EXTERN_MODULE (ICloudDrive, NSObject)

RCT_EXTERN_METHOD(getStatus
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getContainerPath
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(write
                  : (NSString *)key base64
                  : (NSString *)base64 resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(list
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(read
                  : (NSString *)key resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(remove
                  : (NSString *)key resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

@end
