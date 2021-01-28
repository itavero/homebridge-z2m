#!/usr/bin/env sh

# Determine vesrion of zigbee-herdsman-converters based on latest Zigbee2MQTT release
rm -rf _zigbee2mqtt-version.txt
Z2M_VERSION=$(npm view zigbee2mqtt@latest version)
HERDSMAN_VERSION=$(npm view "zigbee2mqtt@$Z2M_VERSION" dependencies.zigbee-herdsman-converters)

# Write version to file so they can be mentioned in the documentation
DOC_VERSIONS_FILE=src/docgen/versions.ts
echo "// This file was generated using generate-docs.sh" > $DOC_VERSIONS_FILE
echo "const version_zigbee2mqtt = '$Z2M_VERSION';" >> $DOC_VERSIONS_FILE
echo "const version_herdsman_converters = '$HERDSMAN_VERSION';" >> $DOC_VERSIONS_FILE
echo "export { version_zigbee2mqtt, version_herdsman_converters };" >> $DOC_VERSIONS_FILE

# Install the new version
npm i --no-save zigbee-herdsman-converters@${HERDSMAN_VERSION}

# Run documentation script
ts-node src/docgen/docgen.ts