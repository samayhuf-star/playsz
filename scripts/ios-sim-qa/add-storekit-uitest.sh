#!/usr/bin/env bash
# Add a UI test target so xcodebuild test can inject Playsz.storekit (simctl launch cannot).
# Only touches the generated ios/ folder on the CI runner.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="${APP_DIR:-$ROOT/app}"
IOS_DIR="$APP_DIR/ios"
SRC_SWIFT="$ROOT/qa/sim-qa/StoreKitUITests/PurchaseRestoreTests.swift"
if [[ ! -d "$IOS_DIR" ]]; then
  echo "Missing ios/; run expo prebuild first." >&2
  exit 1
fi
if [[ ! -f "$SRC_SWIFT" ]]; then
  echo "Missing $SRC_SWIFT" >&2
  exit 1
fi
TEST_DIR="$IOS_DIR/PlayszStoreKitUITests"
mkdir -p "$TEST_DIR"
cp "$SRC_SWIFT" "$TEST_DIR/PurchaseRestoreTests.swift"

export IOS_DIR
ruby << 'RUBY'
require 'xcodeproj'

ios_dir = ENV['IOS_DIR']
proj_path = Dir.glob(File.join(ios_dir, '*.xcodeproj')).first
abort("No xcodeproj in #{ios_dir}") unless proj_path
project = Xcodeproj::Project.open(proj_path)
target_name = 'PlayszStoreKitUITests'
app_target = project.targets.find { |t| t.product_type == 'com.apple.product-type.application' }
abort('No application target in the generated project') unless app_target

target = project.targets.find { |t| t.name == target_name }
if target
  puts "UI test target #{target_name} already present"
else
  target = project.new_target(:ui_test_bundle, target_name, :ios, '16.0')
  group = project.main_group.find_subpath('PlayszStoreKitUITests', true)
  group.set_source_tree('<group>')
  group.set_path('PlayszStoreKitUITests')
  file_ref = group.new_file('PlayszStoreKitUITests/PurchaseRestoreTests.swift')
  target.add_file_references([file_ref])

  target.build_configurations.each do |config|
    s = config.build_settings
    s['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.samayvashsht.playsz.storekituitests'
    s['GENERATE_INFOPLIST_FILE'] = 'YES'
    s['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
    s['TARGETED_DEVICE_FAMILY'] = '1'
    s['CODE_SIGNING_ALLOWED'] = 'NO'
    s['CODE_SIGN_IDENTITY'] = '-'
    s['CODE_SIGN_STYLE'] = 'Manual'
    s['DEVELOPMENT_TEAM'] = ''
    s['TEST_TARGET_NAME'] = app_target.name
    s['BUNDLE_LOADER'] = ''
    s['TEST_HOST'] = ''
  end
  project.save
  puts "Added UI test target #{target_name} hosted by #{app_target.name}"
end

schemes_dir = File.join(proj_path, 'xcshareddata', 'xcschemes')
Dir.glob(File.join(schemes_dir, '*.xcscheme')).each do |scheme_path|
  xml = File.read(scheme_path)
  if xml.include?(%Q{BlueprintName = "#{target_name}"})
    puts "Testable #{target_name} already in #{scheme_path}"
    next
  end
  scheme = Xcodeproj::XCScheme.new(scheme_path)
  scheme.test_action.add_testable(Xcodeproj::XCScheme::TestAction::TestableReference.new(target))
  scheme.save!
  puts "Added #{target_name} testable to #{scheme_path}"
end
RUBY
