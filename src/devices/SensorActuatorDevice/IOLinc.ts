/* Libraries */
import SensorActuatorDevice from './SensorActuatorDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';
import { clamp } from '../../utils';

/* Class for the I/O Linc low voltage contact closure device

 * Due to lack of access to official documentation, all of the commands in this class have been reverse engineered
 * If you find a mistake, please open an issue
 * Developed against an I/O Linc 2450 rev 1.2

 */
export default class IOLinc extends SensorActuatorDevice {

	public setupEvents(){
		/* InsteonDevice emits all packets with type & subtype
		 * type 0x50 = Standard Message Received
		 * subtype 0x06 = Broadcast (Physically Triggered) when the from address matches this device.
		 *
		 * The I/O Linc broadcasts a packet when the sensor is triggered OR when the set button is pressed
		 * In testing, no messages are broadcast when the device is in momentary mode and the relay opens after the momentaryDuration passes.
		 *
		 * The only way to know if the relay is energized is to query the device.
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], this.physicalEventEmitter);

		/* type 0x50 = Standard Message Received
		 * subtype 0x01 = Acknowledgement that a remote command was received
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.ACKofDirectMessage.toString(16)], this.remoteEventEmitter);

		/* Scene responder event
		 * The device responds to the group message using the setting in the link data.
		 */
		this.on(['p', 'scene', 'responder'], this.remoteEventEmitter);
	}

	private physicalEventEmitter(data: Packet.StandardMessageRecieved){
		switch(Number(data.cmd1)){
			case 0x11: this.emitPhysical(['sensor','on'], data); break;
			case 0x13: this.emitPhysical(['sensor','off'], data); break;
			// default: console.log("Unknown Broadcast command",data.cmd1,data.cmd2);
		}
	}

	private remoteEventEmitter(data: Packet.StandardMessageRecieved){
		switch(Number(data.cmd1)){
			case 0x11: this.emitRemote(['relay','on'], data); break;
			case 0x13: this.emitRemote(['relay','off'], data); break;
			case 0x12: this.emitRemote(['relay','on','fast'],data); break;
			case 0x14: this.emitRemote(['relay','off','fast'],data); break;
			// default: console.log("Unknown Ack Command",data.cmd1,data.cmd2);
		}
	}

	/* Command the relay, true = on, false = off */
	public async switchRelay(state: boolean){
		return state ? this.sendInsteonCommand(0x11, 0xFF) : this.sendInsteonCommand(0x13, 0x00);
	}

	// Start device configuration methods

	/* Get the configuration flags from the device */
	public async configRequest(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x1F,0x00);
	}

	/* Parse the flags into an easy to use object
	 *
	 * The configuration flags are as follows:
	 * bit 0: for relay mode
	 * bit 1: trigger is reversed
	 * bit 2: send x10 on/off
	 * bit 3: for relay mode
	 * bit 4: for relay mode
	 * bit 5: relay follows the sensor input
	 * bit 6: LED on Transmit
	 * bit 7: Program lock
	 *
	 * There doesn't seem to be a way to write the flags back, instead each bit is set by it's own command.
	 */
	public async readConfig(){
		// Getting configuration
		const configPacket = await this.configRequest();
		const momentaryDuration = await this.getMomentaryDuration();

		// Convert the flags stored in cmd2 to an array of bits
		// String to base2, pad leading 0s, then split into an array of ints
		const bits = configPacket.cmd2.toString(2).padStart(8,"0").split("").map(bit => parseInt(bit));

		let relayMode = `${bits[0]}${bits[3]}${bits[4]}`;
		switch(relayMode){
			case "000": relayMode = "latching"; break;
			case "001": relayMode = "momentaryModeA"; break;
			case "011": relayMode = "momentaryModeB"; break;
			case "111": relayMode = "momentaryModeC"; break;
		}

		// relayMode =
		return {
			// bit0: bits[0],
			triggerReversed: bits[1],
			X10OnOff: bits[2],
			// bit3: bits[3],
			// bit4: bits[4],
			relayFollowsSensor: bits[5],
			LEDonTX: bits[6],
			programLock: bits[7],
			relayMode: relayMode,
			momentaryDuration: momentaryDuration
		}
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


	/* Set whether the on/off x10 commands are sent or not
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
		0x14/0x15 = Bit 0 hi/low
		0x12/0x13 = Bit 2 hi/low
		0x06/0x07 = Bit 3 hi/low

		// See the I/O Linc manual for the full description of these modes
		0x15, 0x13, 0x07 = 000 = Latching - on activates relay, off deactivates. Momentary Duration is ignored.
		0x15, 0x13, 0x06 = 001 = Momentary A - Either an ON or OFF command can be programmed to trigger the I/O Linc relay. The other command will be ignored. For example, if an ON command is programmed to trigger the relay, an OFF command will be ignored.
		0x15, 0x12, 0x06 = 011 = Momentary B - Send either an ON or an OFF command to trigger the I/O Linc relay. The I/O Linc relay will respond to both.
		0x14, 0x12, 0x06 = 111 = Momentary C - Use the I/O Linc sensor input to determine whether the I/O Linc relay will trigger. An ON command’s desired state can be programmed to either open or closed. I/O Linc will use the opposite for the OFF command’s desired sensor state. For example, if an ON command is programmed to trigger only when the sensor is closed, an OFF command will trigger only when the sensor is open.
	 */
	public async setRelayLatching(): Promise<void>{
		await this.sendInsteonCommand(0x20,0x07);
		await this.sendInsteonCommand(0x20,0x13);
		await this.sendInsteonCommand(0x20,0x15);
	}

	/* Set the type of momentary behavior
		empty|"modeA" = Momentary A
		"modeB"       = Momentary B
		"modeC"       = Momentary C
	 */
	public async setRelayMomentary(type?: String): Promise<void>{
		switch(type){
			case "modeB": // Momentary B
				await this.sendInsteonCommand(0x20, 0x06);
				await this.sendInsteonCommand(0x20, 0x12);
				await this.sendInsteonCommand(0x20, 0x15);
				break;
			case "modeC": // Momentary C
				await this.sendInsteonCommand(0x20, 0x06);
				await this.sendInsteonCommand(0x20, 0x12);
				await this.sendInsteonCommand(0x20, 0x14);
				break
			default:      // Momentary A
				await this.sendInsteonCommand(0x20, 0x06);
				await this.sendInsteonCommand(0x20, 0x13);
				await this.sendInsteonCommand(0x20, 0x15);
		}
	}


	/* Get the relay latch duration setting in seconds
		The duration scale is 0x00 to 0xFF (0 to 25.5 seconds)
		This apparently has to be done with a peek command
	 */
	public async getMomentaryDuration(): Promise<number> {
		await this.sendInsteonCommand(0x28,0x00); // Set MSB 0x00
		const peekPacket = await this.sendInsteonCommand(0x2B,0x33); // Peek address 33

		return 25.5 * peekPacket.cmd2 / 0xFF;
	}

	/* Set the relay latch duration in seconds */
	public async setMomentaryDuration(seconds: number): Promise<Packet.StandardMessageRecieved>{
		// Seconds must be between 0 and 25.5 - 25.5 is just 0xFF with the decimal moved one position
		seconds = clamp(seconds,0,25.5);

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
