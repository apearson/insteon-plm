/* Modem */
import PowerLincModem  from './PowerLincModem';

/* Device Categories */
import DimmableLightingDevice from './devices/DimmableLightingDevices/DimmableLightingDevice';
import SwitchedLightingDevice from './devices/SwitchedLightingDevice/SwitchedLightingDevice';

/* Devices */
import InsteonDevice from './devices/InsteonDevice';
import OutletLinc from './devices/SwitchedLightingDevice/OutletLinc';
import KeypadDimmer  from './devices/DimmableLightingDevices/KeypadDimmer';

/* PLM Types */
import { Packet, PacketID, Byte, AllLinkRecordOperation, AllLinkRecordType, MessageSubtype } from 'insteon-packet-parser';

/* Exporting Modem as default */
export default PowerLincModem;

/* Exporting extras */
export {
  // Device Categories 
  DimmableLightingDevice,
  SwitchedLightingDevice,

  // Devices
  InsteonDevice,
  OutletLinc,
  KeypadDimmer,

  // PLM Types
  Packet,
  PacketID,
  Byte,
  AllLinkRecordOperation,
  AllLinkRecordType,
  MessageSubtype
}


