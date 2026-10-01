Pod::Spec.new do |s|
  s.name           = 'Storefront'
  s.version        = '1.0.0'
  s.summary        = 'Which App Store country the app was installed from'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = 'https://github.com/solomonxie/budgets-bro'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'React-Core'
  s.frameworks = 'StoreKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
