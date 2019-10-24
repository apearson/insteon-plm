/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Base class for device category 0x07 - Sensors & Actuators
   This is where the I/O linc lives, which is commonly used to open & close garage doors
   The rest of the devices in this category seem to be no longer available and otherwise obscure

   Category capabilities defined by the Insteon Developer Guide, Çhapter 8:


I/O Alarm Data Request
cmd1: 0x47 - send data request
cmd2: 0x00
Responds with ED 0x4C00 Alarm Data Response message

I/O Write Output Port (What does this do??)
cmd1: 0x48
cmd2: 0x00-0xFF - value to store. Ack contains bye written to output port in cmd2

I/O Read Input Port (What does this do??)
cmd1: 0x49
cmd2: 0x00

I/O Get sensor value
cmd1: 0x4A
cmd2: 0x00-0xFF - the sensor number to read. I/O linc only has 1, so 0x00?

I/O Set sensor 1 nominal value (what is this used for?)
cmd1: 0x4B = Set Nominal Value for Sensor 1 to reach. Other sensors can be set with ED 0x4Bxx. Set Sensor Nominal
cmd2: 0x00-0xFF = nominal value

I/O Get Sensor Alarm Delta (what is this used for?)
cmd1: 0x4C
cmd2:
	bits 0-3 = sensor number
	bits 4-6 = delta from nominal
	bit 7 = delta direction


I/O Module Control
cmd1: 0x4F
cmd2: 0x00 = Factory Reset
      0x01 = Commit RAM to EEPROM
      0x02 = Status Request (ACK contains the status)
      0x03 = Read Analog Once
      0x04 = Read Analog Always (at preset interval)
      0x05-0x08 = unused
      0x09 = Enable Status Change Message - SB 0x27 Device Status Changed broadcast message each time the input port status changes
      0x0A = Disable status change message
      0x0B = Load RAM from EEPROM
      0x0C = Enable Sensor Reading
      0x0D = Disable Sesnor Reading
      0x0E = Diagnostics On - put device into self diagnostics mode
      0x0F = Diagnostics Off
 */


export default class SensorActuatorDevice extends InsteonDevice {
	// public setupEvents(){
	// 	/* InsteonDevice emits all packets with type & subtype
	// 	   type 0x50 = Standard Message Received
	// 	   subtype 0x06 = Broadcast (Physically Triggered)
	// 	 */
	// 	this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], (data: Packet.StandardMessageRecieved) => {
	// 		switch(Number(data.cmd1)){
	// 			case 0x11: this.emitPhysical(['switch','on'], data); break;
	// 			case 0x13: this.emitPhysical(['switch','off'], data); break;
	// 			case 0x12: this.emitPhysical(['switch','fastOn'], data); break;
	// 			case 0x14: this.emitPhysical(['switch','fastOff'], data); break;
	// 			default: console.log("Unknown Broadcast command",data.cmd1,data.cmd2);
	// 		}
	// 	});
	//
	// 	/* type 0x50 = Standard Message Received
	// 	   subtype 0x01 = Acknowledgement that a remote command was received
	// 	 */
	// 	this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.ACKofDirectMessage.toString(16)], (data: Packet.StandardMessageRecieved) => {
	// 		switch(Number(data.cmd1)){
	// 			case 0x11: this.emitRemote(['switch','on'], data); break;
	// 			case 0x13: this.emitRemote(['switch','off'], data); break;
	// 			case 0x12: this.emitRemote(['switch','fastOn'],data); break;
	// 			case 0x14: this.emitRemote(['switch','fastOff'],data); break;
	// 			default: console.log("Unknown Ack Command",data.cmd1,data.cmd2);
	// 		}
	// 	});
	// }

/*
	I/O Output On
	cmd1: 0x45 - Turn output on
	cmd2: 0x00-0xFF - the output number. I/O linc only has 1, so 0x00?
 */
	public async switchOutputOn(port = 0x00 as Byte){
		return this.sendInsteonCommand(0x45,port);
	}
	
/*
	I/O Output Off
	cmd1: 0x46 - Turn output off
	cmd2: 0x00-0xFF - the output number. I/O linc only has 1, so 0x00?
 */
	public async switchOutputOff(port = 0x00 as Byte){
		return this.sendInsteonCommand(0x46,port);
	}

	public async readEEPROM(){
		return this.sendInsteonCommand(0x4F,0x0B);
	}

	public async writeEEPROM(){
		return this.sendInsteonCommand(0x4F,0x01);
	}

/*	
	I/O Read Configuration Port
	cmd1 = 0x4E - Send read request. The 0x4D ACK contains the byte read in CMD2
	cmd2 = 0x00
 */	
	public async readConfig(){
		// Getting configuration
		const configPacket = await this.configRequest();
		
		// Parse
		console.log("IO Linc Configuration:");
		console.log(configPacket);
	}
	
	public async configRequest(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x4E, 0x00);
	}

/*
	I/O Write Configuration Port
	cmd1 = 0x4D
	cmd2: flags
		bit 0-1: 00 = Analog input not used. 01 = Analog input used, convert upon command. 10 = Analog Input used, convert at fixed interval
		bit   2: 1 = broadcast 0x27 on sensor alarm
		bit   3: 1 = broadcast 0x27 on input port change
		bit   4: 1 = enable 1 wire port (sensors 1-8)
		bit   5: 1 = enable all-link aliasnt to default set
		bit   6: 1 = broadcast 0x27 on output port change
		bit   7: 1 = enable output timers
 */
	public async writeConfig(flags = 0x00 as Byte){
		return this.sendInsteonCommand(0x4D,flags);
	}
	

	//#region Higher functions

	// public switch(state: boolean, level?: Byte, fast: boolean = false){
	//
	// 	return state ? fast ? this.LightOnFast(level)  : this.LightOn(level)
	// 				       : fast ? this.LightOffFast(level) : this.LightOff(level);
	//
	// }

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


	//#endregion

	//#region Device Status

	public async statusRequest(type = 0x00 as Byte): Promise<Packet.StandardMessageRecieved>{
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
}