export interface Zigbee2mqttDeviceInfo {
   ieeeAddr: string;
   type: string;
   networkAddress: number;
   friendly_name: string;
   softwareBuildID?: string;
   dateCode?: string;
   lastSeen: number | null;
   model?: string;
   vendor?: string;
   description?: string;
   manufacturerID?: number | null;
   manufacturerName?: string;
   powerSource?: string;
   modelID?: string;
   hardwareVersion?: number;
}