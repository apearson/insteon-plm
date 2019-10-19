/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte } from 'insteon-packet-parser';

/* Base class for device category 0x01 - Dimmable Lighting Control
   All dimmable controls including switches, outlets and plugin modules live here
 */
export default class DimmableLightingDevice extends InsteonDevice {
	public setupEvents(){

	}


	//#region Higher functions

	public switch(state: boolean, level?: Byte, fast: boolean = false){

		return state ? fast ? this.LightOnFast(level)  : this.LightOn(level)
					       : fast ? this.LightOffFast(level) : this.LightOff(level);

	}

	public async getDeviceStatus(){

		// Getting status
		const statusPacket = await this.statusRequest();

		// Parsing status out
		return {
			level: statusPacket.cmd2,
		};

	}

	//#endregion

	//#region Insteon Methods

	//#region Device Actions 

	public beep(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x30, 0x00);
	}

	//#endregion

	//#region Device Status

	public statusRequest(type = 0x00 as Byte): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x19, type);
	}

	//#endregion

	//#region Light Methods 

	public async LightOn(level: Byte = 0xFF): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x11, level);
	}

	public async LightOnFast(level: Byte = 0xFF): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x12, level);
	}

	public async LightOff(level: Byte = 0x00): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x13, level);
	}

	public async LightOffFast(level: Byte = 0x00): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x14, level);
	}

	public async InstantOnOff(level: Byte): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x21, level);
	}

	//#endregion

	//#region Device Settings 

	//#endregion

	//#region Linking Methods

	public stopRemoteLinking(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x08, 0x00);
	}

	//#endregion

	//#endregion

}
