/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';
import { clamp, toAddressString } from '../../utils';

/* Base class for device category 0x01 - Dimmable Lighting Control
   All dimmable controls including switches, outlets and plugin modules live here

   Category capabilities defined by the Insteon Developer Guide, Çhapter 8:

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
Light Set Status: 0x27, 0x00-0xFF (level) Updates the LEDs?
Light On @ Ramp Rate: 0x2E, 0x00-0xFF (on level + ramp rate combined Bits 0-3 = 2 x Ramp Rate + 1 Bits 4-7 = On-Level + 0x0F)

## These apply to all devices EXCEPT the keypad dimmer

 */
export default class DimmableLightingDevice extends InsteonDevice {


	public setupEvents(){
		/* InsteonDevice emits all packets with type & subtype
		   type 0x50 = Standard Message Received
		   subtype 0x06 = Broadcast (Physically Triggered) when the from address matches this device.
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], this.physicalEventEmitter);

		/* type 0x50 = Standard Message Received
		   subtype 0x01 = Acknowledgement that a remote command was received
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.ACKofDirectMessage.toString(16)], this.remoteEventEmitter);
		
		/* type 0x50 = Standard Message Received
		   subtype 0x06 = Broadcast (Remotely Triggered) when the from address DOES NOT match this device
		   The device responds to the group message using the link data. A group `on` message can result in a device turning off if the device's
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], this.remoteEventEmitter);
		
	}
	
	private physicalEventEmitter(data: Packet.StandardMessageRecieved){
		switch(data.cmd1){
			case 0x11: this.emitPhysical(['switch','on'], data); break;
			case 0x13: this.emitPhysical(['switch','off'], data); break;
			case 0x12: this.emitPhysical(['switch','on','fast'], data); break;
			case 0x14: this.emitPhysical(['switch','off','fast'], data); break;
			case 0x17:
				switch(data.cmd2){
					case 0x0: this.emitPhysical(['dim','continuous','down'], data); break;
					case 0x1: this.emitPhysical(['dim','continuous','up'], data); break;
				}
				break;
			case 0x18: this.emitPhysical(['dim','continuous','stop'], data); break;
			case 0x22: this.emitPhysical(['switch','off','loadSense'], data); break; // In testing, these do not work as the device only outputs 0x11/0x13
			case 0x23: this.emitPhysical(['switch','on','loadSense'], data); break;
			// default: console.log("Unknown Broadcast command",data.cmd1,data.cmd2);
		}
	}
	
	private remoteEventEmitter(data: Packet.StandardMessageRecieved){		
		switch(data.cmd1){
			case 0x11: this.emitRemote(['switch','on'], data); break;
			case 0x13: this.emitRemote(['switch','off'], data); break;
			case 0x12: this.emitRemote(['switch','on','fast'],data); break;
			case 0x14: this.emitRemote(['switch','off','fast'],data); break;
			case 0x15: this.emitRemote(['dim','step','up'],data); break;
			case 0x16: this.emitRemote(['dim','step','down'],data); break;
			case 0x17:
				switch(data.cmd2){
					case 0x0: this.emitRemote(['dim','continuous','down'],data); break;
					case 0x1: this.emitRemote(['dim','continuous','up'],data); break;
				}
				break;
			case 0x18: this.emitRemote(['dim','continuous','stop'], data); break;
			case 0x21: this.emitRemote(['switch','on','instant'], data); break;
			// default: console.log("Unknown Ack Command",data.cmd1,data.cmd2);
		}
	}

	//#region Higher functions

	public switch(state: boolean, level?: Byte, fast: boolean = false){

		return state ? fast ? this.LightOnFast(level)  : this.LightOn(level)
					       : fast ? this.LightOffFast() : this.LightOff();

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

	//#region Device configuration methods

	/* Get the configuration flags from the device */
	public async configRequest(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x1F,0x00);
	}

	/* Parse the flags into an easy to use object
		Get Operating Flags: 0x1F, 0x00 -> Returned ACK will contain requested data in CMD2
		bit 0: 0 = Program Lock Off, 1 = On
		bit 1: 0 = LED Off during transmit, 1 = On
		bit 2: 0 = Resume Dim Disabled, 1 = Enabled
		bit 3: 0 = Load Sense Off, 1 = on (docs are wrong?)
		bit 4: 0 = LED Off, 1 = on
		bit 5: Unused
		bit 6&7 are not used
	 */
	public async readConfig(){
		// Getting configuration
		const configPacket = await this.configRequest();

		// Convert the flags stored in cmd2 to an array of bits
		// String to base2, pad leading 0s, then split into an array of ints. Reverse it so that the array index matches the bit index
		const bits = configPacket.cmd2.toString(2).padStart(8,"0").split("").reverse().map((bit: string) => parseInt(bit));

		return {
			bits: bits,
			programLock: bits[0],
			LEDonTX: bits[1],
			resumeDim: bits[2],
			loadSense: bits[3],
			LEDDisabled: bits[4]
		}
	}

	/* 	Set Operating Flags:
		cmd1 = 0x20,
		cmd2 = The flag to alter
		user data 14 = checksum
	*/
	public async setConfigFlag(cmd2: Byte): Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>{
		const cmd1 = 0x20;
		const extendedData = new Array(13).fill(0x00);
		extendedData.push(InsteonDevice.calulateChecksum(cmd1, cmd2, extendedData));

		return this.sendInsteonCommand(cmd1, cmd2, extendedData);
	}

	/* Set the program lock flag
		0x00 = locked
		0x01 = unlocked
	*/
	public async setProgramLock(state: boolean): Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>{
		return await this.setConfigFlag(state ? 0x00 : 0x01);
	}

	/* Set whether the LED flashes on TX
		0x02 = true
		0x03 = false
	*/
	public async setLEDonTX(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return await this.setConfigFlag(state ? 0x02 : 0x03);
	}

	/* Set whether the switch resumes its dim state
		0x04 = true
		0x05 = false
	*/
	public async setResumeDim(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.setConfigFlag(state ? 0x04 : 0x05);
	}

	/* Set whether load sense is active
		0x06 = true
		0x07 = false
	*/
	public async setLoadSense(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.setConfigFlag(state ? 0x06 : 0x07);
	}

	/* Set whether the status LED is disabled (on)
		0x08 = true
		0x09 = false
	*/
	public async setLEDDisabled(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.setConfigFlag(state ? 0x08 : 0x09);
	}

	/* Extended Get
		cmd1: 0x2E
		cmd2: 0x00
		user data  1: 0x00-0xFF = target button. This class is for single button devices, so the button # is always the first one.
		user data  2: 0x00 = Data Request
		user data  3-14: 0x00 Unused

		Response:
		user data  2: 0x01 = Data Response to data request 0x00
		user data  3: Unused
		user data  4: Unused
		user data  5: 0x00-0x0F = X10 House Code (0x20 = none);
		user data  6: 0x00-0x0f = X10 Unit Code
		user data  7: 0x00-0x1F = Ramp Rate
		user data  8: 0x00-0xFF = On Level
		user data  9: 0x00-0xFF = Signal to noise threshold (what is this for?)
		user data 10-14: Unused
	*/

	public extendedConfigRequest = (button: Byte = 0x01) => new Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>((resolve, reject) => {
		// Catch the extended configuration data packet
		this.once(
			['p',PacketID.ExtendedMessageReceived.toString(16),0x00.toString(16)],
			(packet: Packet.ExtendedMessageRecieved) =>  resolve(packet)
		);

		this.sendInsteonCommand(0x2E, 0x00,[button,0x00]);
	});

	public async readExtendedConfig(button: Byte = 0x01){
		const packet = await this.extendedConfigRequest(button);

		return {
			extendedData: packet.extendedData,
			x10HouseCode: packet.extendedData[4],
			x10UnitCode: packet.extendedData[5],
			rampRate: packet.extendedData[6],
			onLevel: packet.extendedData[7],
			signalToNoise: packet.extendedData[8]
		}
	}


	/* Extended Set:
		cmd1: 0x2E
		cmd2: 0x00
		user data  1: 0x00-0xFF = target button. Always using 0x01 in this class because these devices have a single button.
	*/

	public async setExtendedConfigFlag(setting: Byte, value: Byte, button: Byte = 0x01): Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>{
		const cmd1 = 0x2E;
		const cmd2 = 0x00;
		const extendedData = new Array(13).fill(0x00);
		extendedData[0] = button;
		extendedData[1] = setting;
		extendedData[2] = value;
		extendedData.push(InsteonDevice.calulateChecksum(cmd1, cmd2, extendedData));

		return this.sendInsteonCommand(cmd1, cmd2, extendedData);
	}

	/*	Set Ramp Rate
		user data  2: 0x05 = set ramp rate
		user data  3: 0x00-0x1F = ramp rate from .1 seconds (0x1F) to 9 minutes (0x00)
		user data  4-14: Unused
	*/
	public async setRampRate(rate: Byte, button: Byte = 0x01): Promise<Packet.StandardMessageRecieved>{
		// rate must be between 0 and 31
		rate = clamp(rate,0,0x1F) as Byte;

		return this.setExtendedConfigFlag(0x05, rate);
	}

	/* 	Set On Level
		user data  2: 0x06 = set on level
		user data  3: 0x00-0xFF = on level
		user data  4-14: Unused
	*/
	public async setOnLevel(level: Byte, button: Byte = 0x01): Promise<Packet.StandardMessageRecieved>{
		level = clamp(level,0x00,0xFF) as Byte;

		return this.setExtendedConfigFlag(0x06, level);
	}

	/* Set X10 Address
		user data  2: 0x04 = Set X10 Address
		user data  3: 0x00-0x0F = X10 House Code (0x20 = none);
		user data  4: 0x00-0x0F = X10 Unit Code
		user data  5-14: unused
	*/
	public async setX10Address(house: Byte, unit: Byte, button: Byte = 0x01): Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>{
		house = clamp(house,0x00,0x20) as Byte;
		unit = clamp(unit,0x00,0x20) as Byte;
		if(house > 0x0F){ house = 0x20; } // 0x0F is the upper limit of assignable codes, while 0x20 is none
		if(unit > 0x0F){ unit = 0x20; }

		const cmd1 = 0x2E;
		const cmd2 = 0x00;
		const extendedData = new Array(13).fill(0x00);
		extendedData[0] = button;
		extendedData[1] = 0x04;
		extendedData[2] = house;
		extendedData[3] = unit;
		extendedData.push(InsteonDevice.calulateChecksum(cmd1, cmd2, extendedData));

		return this.sendInsteonCommand(cmd1, cmd2, extendedData);
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

	public async LightOff(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x13, 0x00);
	}

	public async LightOffFast(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x14, 0x00);
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

	/* Not yet tested. Based soley on documentation */
	public async setIndicatorLED(level: Byte): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x27,level);
	}

	/* Not yet tested. Based soley on documentation
		Light On @ Ramp Rate: 0x2E, 0x00-0xFF (on level + ramp rate combined)
		Bits 0-3 = 2 x Ramp Rate +
		1 Bits 4-7 = On-Level + 0x0F)

		Because the ramp rate and level are combined into one byte, they are compressed and have less resolution.
		Ramp rates are 0x00 = 9 minutes thru 0x0F = 0.1 seconds
	*/
	public async LightOnAtRate(level: Byte, rate: Byte){
		level = clamp(level,0x00,0x0F) as Byte;
		rate = clamp(rate,0x00,0x0F) as Byte;

		const muxed = parseInt(`${level.toString(2)}${rate.toString(2)}`,2) as Byte;

		return this.sendInsteonCommand(0x2E, muxed);
	}
	public async LightOffAtRate(rate: Byte){
		rate = clamp(rate,0x00,0x0F) as Byte;

		const muxed = parseInt(`0000${rate.toString(2)}`,2) as Byte;

		return this.sendInsteonCommand(0x2E, muxed);
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
