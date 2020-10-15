export interface MqttConfiguration {
   base_topic : string;
   server: string;
   ca?: string;
   key?: string;
   cert?: string;
   user?: string;
   password?: string;
   client_id?: string;
   reject_unauthorized?: boolean;
   keepalive?: number;
   version?: number;
}