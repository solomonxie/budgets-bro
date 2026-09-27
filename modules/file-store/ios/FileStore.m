#import <React/RCTBridgeModule.h>

// The Objective-C face of FileStoreModule.swift — see ICloudDrive.m.
@interface RCT_EXTERN_MODULE (FileStore, NSObject)

RCT_EXTERN_METHOD(exists
                  : (NSString *)path resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(mkdir
                  : (NSString *)path resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(readDir
                  : (NSString *)path resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(readBase64
                  : (NSString *)path resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(writeBase64
                  : (NSString *)path base64
                  : (NSString *)base64 resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(remove
                  : (NSString *)path resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(copy
                  : (NSString *)from to
                  : (NSString *)to resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(move
                  : (NSString *)from to
                  : (NSString *)to resolve
                  : (RCTPromiseResolveBlock)resolve reject
                  : (RCTPromiseRejectBlock)reject)

@end
