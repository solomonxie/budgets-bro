Pod::Spec.new do |s|
  s.name           = 'ICloudDrive'
  s.version        = '1.0.0'
  s.summary        = 'Reads and writes the app’s iCloud Drive folder'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = 'https://github.com/solomonxie/build-your-own-budget'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
