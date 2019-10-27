/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Base class for device category 0x01 - Dimmable Lighting Control
   All dimmable controls including switches, outlets and plugin modules live here

   Category capabilities defined by the Insteon Developer Guide, Çhapter 8:
          cmd1  cmd2
Light On: 0x11, OnLevel: 0x00 - 0xFF
Light On Fast: 0x12, OnLevel: 0x00 - 0xFF
Light Off: 0x13, 0x00 (Not Parsed)
Light Off Fast: 0x14, 0x00 (Not parsed)
Light Brighten One Step: 0x15, 0x00 (Not parsed)
Light Dim One Step: 0x16, 0x00 (Not parsed)
Light Start Manual Change: 0x17, Direction: 0x00 = Down, 0x01 = Up, 0x02-0xFF Unused
Light Stop Manual Change: 0x18, 0x00 (Not parsed)
Light Status Request: 0x19, 0x00 -> Returned ACK will contain On Level in CMD2
Light Instant Change: 0x21, 0x00-0xFF (level)
Light Manually Turned Off: 0x22, 0x00 (Not parsed) Load sense
Light Manually Turned On: 0x23, 0x00 (Not parsed) Load sense
Remote SET Button Tap: 0x25, 0x01 = 1 Tap, 0x02 = 2 Taps
Light Set Status: 0x27, 0x00-0xFF (level) Updates the LEDs
Light On @ Ramp Rate: 0x2E, 0x00-0xFF (on level + ramp rate combined Bits 0-3 = 2 x Ramp Rate + 1 Bits 4-7 = On-Level + 0x0F)


## These apply to all devices EXCEPT the keypad dimmer
Get Operating Flags: 0x1F, 0x00 -> Returned ACK will contain requested data in CMD2
Bit 0: 0 = Program Lock Off, 1 = On
Bit 1: 0 = LED Off during transmit, 1 = On 
Bit 2: 0 = Resume Dim Disabled, 1 = Enabled
Bit 3: Unused
Bit 4: 0 = LED Off, 1 = on
Bit 5: 0 = Load Sense Off, 1 = on
Bit 6&7 are not used

Set Operating Flags: 0x20, cmd2 = The flag to alter
Flags:
0x00/0x01: Program Lock On/Off
0x02/0x03: LED During Tx On/Off
0x04/0x05: Resume Dim On/Off
0x06/0x07: Load Sense On/Off
0x08/0x09: LED Off/On

Extended Get
cmd1: 0x2E
cmd2: 0x00
user data  1: 0x00-0xFF = target button
and...

user data  2: 0x00 = Data Request
user data  3-14: 0x00 Unused

user data  2: 0x01 = Data Response to data request 0x00
user data  3: Unused
user data  4: Unused
user data  5: 0x00-0x0F = X10 House Code (0x20 = none);
user data  6: 0x00-0x0f = X10 Unit Code
user data  7: 0x00-0x1F = Ramp Rate
user data  8: 0x00-0xFF = On Level
user data  9: 0x00-0xFF = Signal to noise threshold (what is this for?)
user data 10-14: Unused

Extended Set:
cmd1: 0x2E
cmd2: 0x00
user data  1: 0x00-0xFF = target button
and...

Set X10 Address
user data  2: 0x04 = Set X10 Address
user data  3: 0x00-0x0F = X10 House Code (0x20 = none);
user data  4: 0x00-0x0F = X10 Unit Code
user data  5-14: unused

Set Ramp Rate
user data  2: 0x05 = set ramp rate
user data  3: 0x00-0x1F = ramp rate from .1 seconds to 9 minutes
user data  4-14: Unused

Set On Level
user data  2: 0x06 = set on level
user data  3: 0x00-0xFF = on level
user data  4-14: Unused

 */
export default class DimmableLightingDevice extends InsteonDevice {
	public setupEvents(){
		/* InsteonDevice emits all packets with type & subtype
		   type 0x50 = Standard Message Received
		   subtype 0x06 = Broadcast (Physically Triggered)
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], (data: Packet.StandardMessageRecieved) => {
			switch(Number(data.cmd1)){
				case 0x11: this.emitPhysical(['switch','on'], data); break;
				case 0x13: this.emitPhysical(['switch','off'], data); break;
				case 0x12: this.emitPhysical(['switch','fastOn'], data); break;
				case 0x14: this.emitPhysical(['switch','fastOff'], data); break;
				case 0x17:
					switch(Number(data.cmd2)){
						case 0x0: this.emitPhysical(['dim','startDimming'], data); break;
						case 0x1: this.emitPhysical(['dim','startBrigthening'], data); break;
					}
					break;
				case 0x18: this.emitPhysical(['dim','stoppedChanging'], data); break;
				// default: console.log("Unknown Broadcast command",data.cmd1,data.cmd2);
			}
		});
	
		/* type 0x50 = Standard Message Received
		   subtype 0x01 = Acknowledgement that a remote command was received
		 */		
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.ACKofDirectMessage.toString(16)], (data: Packet.StandardMessageRecieved) => {
			switch(Number(data.cmd1)){
				case 0x11: this.emitRemote(['switch','on'], data); break;
				case 0x13: this.emitRemote(['switch','off'], data); break;
				case 0x12: this.emitRemote(['switch','fastOn'],data); break;
				case 0x14: this.emitRemote(['switch','fastOff'],data); break;
				case 0x15: this.emitRemote(['dim','brightenOneStep'],data); break;
				case 0x16: this.emitRemote(['dim','dimOneStep'],data); break;
				case 0x17:
					switch(Number(data.cmd2)){
						case 0x0: this.emitRemote(['dim','startDimming'],data); break;
						case 0x1: this.emitRemote(['dim','startBrigthening'],data); break;
					}
					break;
				case 0x18: this.emitRemote(['dim','stoppedChanging'], data); break;
				// default: console.log("Unknown Ack Command",data.cmd1,data.cmd2);
			}
		});
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
	
	/* There are 32 steps between On & Off */
	public async BrightenOneStep(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x15, 0x00);
	}
	
	public async DimOneStep(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x16, 0x00);
	}
	
	/* Continuously brightening or dimming until the stop command is sent */
	public async BeginBrightening(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x17,0x01);
	}
	
	public async BeginDimming(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x17,0x00);
	}
	
	public async StopChanging(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x18,0x00);
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
