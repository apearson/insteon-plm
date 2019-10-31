/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Base class for device category 0x02 - Switched Lighting Control
   All NON dimmable controls including switches, outlets and plugin modules live here
 */
export default class SwitchedLightingDevice extends InsteonDevice {
	public setupEvents(){
		/* InsteonDevice emits all packets with type & subtype
		   type 0x50 = Standard Message Received
		   subtype 0x06 = Broadcast (Physically Triggered)
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], (data: Packet.StandardMessageRecieved) => {
			switch(Number(data.cmd1)){
				case 0x11: this.emitPhysical(['switch','on'], data); break;
				case 0x13: this.emitPhysical(['switch','off'], data); break;
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
				case 0x12: this.emitRemote(['switch','on','fast'],data); break;
				case 0x14: this.emitRemote(['switch','off','fast'],data); break;
				case 0x21: this.emitRemote(['switch','on','instant'], data); break;
				// default: console.log("Unknown Ack Command",data.cmd1,data.cmd2);
			}
		});
	}
	

	//#region Higher functions

	public switch(state: boolean, level?: Byte, fast: boolean = false){

		state ? fast ? this.LightOnFast()  : this.LightOn()
					: fast ? this.LightOffFast() : this.LightOff();

	}

	/* On/Off devices return 0x00 or 0xFF in cmd2 only */
    public async getDeviceStatus(){

		// Getting status
		const statusPacket = await this.statusRequest();

		// Parsing status out
		return {
			level: statusPacket.cmd2,
		};

	}

	//#endregion
  
	// Start device configuration methods
	/* Get the configuration flags from the device */
	public async configRequest(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x1F,0x00);
	}
	
	/* Parse the flags into an easy to use object
		Get Operating Flags: 0x1F, 0x00 -> Returned ACK will contain requested data in CMD2
		bit 0: 0 = Program Lock Off, 1 = On
		bit 1: 0 = LED Off during transmit, 1 = On 
		bit 2: 0 = Resume Dim Disabled, 1 = enabled (Why is this a thing on on/off devices?)
		bit 3: 0 = Load Sense Off, 1 = on (docs are wrong?)
		bit 4: 0 = LED Off, 1 = on
		bit 5: Unused
		bit 6&7 Unused
	 */
	public async readConfig(){
		// Getting configuration
		const configPacket = await this.configRequest();

		// Convert the flags stored in cmd2 to an array of bits
		// String to base2, pad leading 0s, then split into an array of ints. Reverse it so that the array index matches the bit index
		const bits = configPacket.cmd2.toString(2).padStart(8,"0").split("").reverse().map(bit => parseInt(bit));
		
		return {
			bits: bits,
			programLock: bits[0],
			LEDonTX: bits[1],
			// resumeDim: bits[2],
			loadSense: bits[3],
			LEDDisabled: bits[4]
		}
	}
	
	/* 	Set Operating Flags: 
		cmd1 = 0x20,
		cmd2 = The flag to alter
		user data 14 = checksum
	*/
	public async setConfigurationFlag(cmd2: Byte): Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>{
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
		return await this.setConfigurationFlag(state ? 0x00 : 0x01);
	}

	/* Set whether the LED flashes on TX
		0x02 = true
		0x03 = false
	*/
	public async setLEDonTX(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return await this.setConfigurationFlag(state ? 0x02 : 0x03);
	}
	
	/* Set whether the switch resumes its dim state
		0x04 = true
		0x05 = false
	*/
	public async setResumeDim(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.setConfigurationFlag(state ? 0x04 : 0x05);
	}
	
	/* Set whether load sense is active
		0x06 = true
		0x07 = false
	*/
	public async setLoadSense(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.setConfigurationFlag(state ? 0x06 : 0x07);
	}
	
	/* Set whether the status LED is disabled (on)
		0x08 = true
		0x09 = false
	*/
	public async setLEDDisabled(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.setConfigurationFlag(state ? 0x08 : 0x09);
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
		user data  7: Unused
		user data  8: Unused
		user data  9: Unused
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
			x10UnitCode: packet.extendedData[5]
		}
	}
	
	/* Set X10 Address (these are the only extended config commands that on/off devices have according to the docs)
		user data  2: 0x04 = Set X10 Address
		user data  3: 0x00-0x0F = X10 House Code (0x20 = none);
		user data  4: 0x00-0x0F = X10 Unit Code
		user data  5-14: unused
	*/
	public async setX10Address(house: Byte, unit: Byte, button: Byte = 0x01): Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>{
		if(house > 0x0F){ house = 0x20; } // 0x0F is the upper limit of assignable codes, while 0x20 is none
		if(unit > 0x0F){ unit = 0x20; }
		if(house < 0){ house = 0; }
		if(unit < 0){ unit = 0; }
		
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
		
	// End device configuration methods
  
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
	

	//#region Lighting Methods

	public async LightOn(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x11, 0xFF);
	}

	public async LightOnFast(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x12, 0xFF);
	}

	public async LightOff(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x13, 0x00);
	}

	public async LightOffFast(): Promise<Packet.StandardMessageRecieved> {
		return this.sendInsteonCommand(0x14, 0x00);
	}

  //#endregion

  //#region Linking Methods

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