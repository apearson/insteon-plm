/* Libraries */
import InsteonDevice, { DeviceOptions } from './InsteonDevice';
import PLM from '../main';

/* Types */
import { Byte, Packets, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Class */
export default class KeypadDimmer extends InsteonDevice {
	constructor(deviceID: Byte[], modem: PLM, options?: DeviceOptions){
		super(deviceID, modem, options);
	}

	public getDeviceStatus = async () => {

		// Getting status
		const statusPacket = await this.getStatus();

		// Setting up command
		const cmd1 = 0x19;
		const cmd2 = 0x01;

		/* Sending command */
		const ledPacket = await this.sendInsteonCommand(cmd1, cmd2);

		// Parsing status out
		return {
			level: statusPacket.cmd2,
			led: ledPacket.cmd2
		}

	}

}