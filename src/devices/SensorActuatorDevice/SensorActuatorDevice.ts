/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte } from 'insteon-packet-parser';

/* Base class for device category 0x07 - Sensors & Actuators
   This is where the I/O linc lives, which is commonly used to open & close garage doors
   The rest of the devices in this category seem to be no longer available and otherwise obscure
 */
export default class SensorActuatorDevice extends InsteonDevice {

}