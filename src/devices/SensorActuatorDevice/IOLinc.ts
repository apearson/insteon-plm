/* Libraries */
import SensorActuatorDevice from './SensorActuatorDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Class for the I/O Linc low voltage contact closure device

 * Due to lack of access to official documentation, all of the commands in this class have been reverse engineered through trial and error.
 * If you find a mistake, please open an issue

 */
export default class IOLinc extends SensorActuatorDevice {

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

	/* Command the relay, true = on, false = off */
	public async switchRelay(state: boolean){
		return state ? this.sendInsteonCommand(0x11, 0xFF) : this.sendInsteonCommand(0x13, 0x00);
	}


	// Start device configuration methods
	/* The configuration flags are as follows:
	   bit 0:
	   bit 1:
	   bit 2:
	   bit 3:
	   bit 4:
	   This method parses them out into an object.
	   There doesn't seem to be a way to write the flags back, instead each bit is set by it's own command.
	 */
	public async readConfig(){
		// Getting configuration
		const configPacket = await this.configRequest();

		// Convert the flags stored in cmd2 to an array of bits
		// String to base2, pad leading 0s, then split into an array of ints
		const bits = configPacket.cmd2.toString(2).padStart(8,"0").split("").map(bit => parseInt(bit));
		
		// bit4: 0 = latching; 1 = momentary
		
		// let relayMode = `${bits[0]}${bits[3]}${bits[4]}`;
		// switch(relayMode){
		// 	case "110": relayMode = "unknown"; break;
		// 	case "000": relayMode = "latching"; break;
		// 	case "001": relayMode = "momentary"; break;
		// 	case "011": relayMode = "momentaryReverse"; break;
		// 	case "111": relayMode = "momentaryEither"; break;
		// }
		
		// relayMode =
		return {
			bit0: bits[0],
			triggerReversed: bits[1],
			X10OnOff: bits[2],
			bit3: bits[3],
			momentary: bits[4],
			relayFollowsSensor: bits[5],
			LEDonTX: bits[6],
			programLock: bits[7],
			// relayMode: relayMode
		}
	}
	
	/* Get the configuration flags from the device */
	public async configRequest(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x1F,0x00);
	}
	
	/* Set the program lock flag
		0x00 = locked
		0x01 = unlocked
	*/
	public async setProgramLock(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x20, state ? 0x00 : 0x01);
	}

	/* Set whether the LED flashes on TX
		0x02 = true
		0x03 = false
	*/
	public async setLEDonTX(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x20, state ? 0x02 : 0x03);
	}
	
	/* Set whether the trigger should be inverted
		0x0E = Trigger Reverse True
		0x0F = Trigger Reverse False
	 */
	public async setTriggerReversed(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x20, state ? 0x0E : 0x0F);
	}
	
	/* Set the key beep on or off
		0x0A = Key Beep True
		0x0B = Key Beep False
	 */
	public async setKeyBeep(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x20, state ? 0x0A : 0x0B);
	}
	
	/* Set the x10 commands are on off
		0x0C = Send X10 On/Off True
		0x0D = Send X10 On/Off False
	 */
	public async setX10OnOff(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x20, state ? 0x0C : 0x0D);
	}

	/* Set whether the Relay should follow the Sensor input.
		0x04 = true
		0x05 = false
	*/
	public async setRelayFollowsSensor(state: boolean): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x20, state ? 0x04 : 0x05);
	}

	/* Set the relay's behavior
		0x07 = Latching - on activates relay, off deactivates
		0x06 = Momentary 1 - on activates relay, off deactivates
		0x12 = Momentary 2 - off activates relay, on deactivates
		0x14 = Momentary 3 - Both on or off activates the relay
	 */
	public async setRelayLatching(): Promise<Packet.StandardMessageRecieved>{
		return this.setRelayMode(0x07);
	}
	
	/* Set the type of momentary behavior
		empty = Momentary 1
		"reverse" = Momentary 2
		"either" = Momentary 3
	 */
	public async setRelayMomentary(type?: String): Promise<Packet.StandardMessageRecieved>{
		switch(type){
			case "reverse": return this.setRelayMode(0x12); // Momentary 2
			case "either": return this.setRelayMode(0x14); // Momentary 3
			default: return this.setRelayMode(0x06); // Momentary 1
		}
	}
	public async setRelayMode(flag: Byte): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x20,flag);
	}


	/* Get the relay latch duration setting
		The duration scale is 0x00 to 0xFF (0 to 25.5 seconds)
		This apparently has to be done with a peek command
	 */
	public async getMomentaryDuration(): Promise<number> {
		await this.sendInsteonCommand(0x28,0x00); // Set MSB 0x00
		const peekPacket = await this.sendInsteonCommand(0x2B,0x33); // Peek address 33
		
		return 25.5 * peekPacket.cmd2 / 0xFF;
	}
	public async setMomentaryDuration(seconds: number): Promise<Packet.StandardMessageRecieved>{
		// Seconds must be between 0 and 25.5 - 25.5 is just 0xFF with the decimal moved one position
		if(seconds > 25.5){ seconds = 25.5; }
		if(seconds < 0){ seconds = 0; }
		
		// Scale the seconds value
		// 25.5 seconds should be 255(0xFF)
		const value = seconds * 10 as Byte;
		return this.sendInsteonCommand(0x2E,0x00,[0x01,0x06,value]);
	}
	
	// end device configuration methods

		

	//#region Higher functions

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


	//#region Device Settings 

	//#endregion

	//#region Linking Methods

	public stopRemoteLinking(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x08, 0x00);
	}

	//#endregion
}
