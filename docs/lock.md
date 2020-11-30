# Lock Mechanism
If the device definition from zigbee2mqtt contains one or more `exposes` entries of type `lock` that have the required features from the table below, a [Lock Mechanism](https://developers.homebridge.io/#/service/LockMechanism) service will be created.
The table below shows how the different features within this `exposes` entry are mapped to characteristics.

| Name | Required access | Characteristic | Remarks |
|-|-|-|-|
| `state` | published, set | [Lock Target State](https://developers.homebridge.io/#/characteristic/LockTargetState) | Required |
| `lock_state` | published | [Lock Current State](https://developers.homebridge.io/#/characteristic/LockCurrentState) | Required |