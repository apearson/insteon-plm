/* Libraries */
import DimmableLightingDevice from './DimmableLightingDevice';
import { Packet } from 'insteon-packet-parser';

/* Class */
export default class KeypadDimmer extends DimmableLightingDevice {

  public async getDeviceStatus(){

    const status = await super.getDeviceStatus();

    const ledStatus = await this.sendInsteonCommand(0x2E, 0x00, [0x00, 0x00]) as Packet.ExtendedMessageRecieved;

    // console.log(ledStatus);

    return {
      level: status.level,
      // led: ledStatus.extendedData[9],
    }

  }
}
