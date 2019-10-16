/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte } from 'insteon-packet-parser';

/* Class */
export default abstract class DimmableLightingDevice extends InsteonDevice {

	//#region Higher functions

	public switch(state: boolean, level?: Byte, fast: boolean = false){

		state ? fast ? this.LightOnFast(level)  : this.LightOn(level)
					: fast ? this.LightOffFast(level) : this.LightOff(level);

	}

	public async getDeviceStatus(){

		// Getting status
		const statusPacket = await this.statusRequest();

		// Parsing status out
		return {
			level: statusPacket.cmd2,
		}

	}

	//#endregion

	//#region Insteon Methods

	//#region Device Actions 

	public beep(): Promise<Packet.StandardMessageRecieved>{

		// Setting up command
		const cmd1 = 0x30;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	//#endregion

	//#region Device Status

	public statusRequest(): Promise<Packet.StandardMessageRecieved>{

		// Setting up command
		const cmd1 = 0x19;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
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

	public async remoteTapSetButton(what2Set: 0x00 | 0x02): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x21, what2Set); 
	}

	public stopRemoteLinking(): Promise<Packet.StandardMessageRecieved>{

		// Setting up command
		const cmd1 = 0x08;
		const cmd2 = 0x00;

		/* Sending command */
		return this.sendInsteonCommand(cmd1, cmd2);
	}

	//#endregion

	//#endregion

}
