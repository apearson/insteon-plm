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

	public switch(state: boolean, level?: Byte, fast: boolean = false){

		let type: Byte = state ? fast ? 0x12 : 0x11  // On
		                       : fast ? 0x14 : 0x13  // Off

		if(level === undefined){
			level = state? 0xFF : 0x00
		}

		return this.sendInsteonCommand(type, level);
	}

	public async getDeviceStatus(){

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