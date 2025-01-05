#!/usr/bin/env sh

# Determine version of zigbee-herdsman-converters based on latest Zigbee2MQTT release
Z2M_VERSION=$(npm view zigbee2mqtt@latest version)
HERDSMAN_VERSION=$(npm view "zigbee2mqtt@$Z2M_VERSION" dependencies.zigbee-herdsman-converters)

# Write version to file so they can be mentioned in the documentation
DOC_VERSIONS_FILE=src/docgen/versions.ts
{
   echo "// GENERATED FILE: DO NOT EDIT MANUALLY!" 
   echo "const version_zigbee2mqtt = '$Z2M_VERSION';"
   echo "const version_herdsman_converters = '$HERDSMAN_VERSION';"
   echo "export { version_zigbee2mqtt, version_herdsman_converters };"
} > $DOC_VERSIONS_FILE

# Install the new version
npm i --no-save zigbee-herdsman-converters@${HERDSMAN_VERSION}

# Run documentation script
npx ts-node src/docgen/docgen.ts