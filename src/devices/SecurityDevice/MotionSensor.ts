/* Libraries */
import InsteonDevice from '../InsteonDevice';
import SecurityDevice from './SecurityDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

export interface MotionSensorConfigOptions {
	onCommandsOnlyDisabled?: boolean;
	nightOnlyModeDisabled?: boolean;
	LEDEnabled?: boolean;
	onlyAfterTimeoutDisabled?: boolean;
}

/* Class */
export default class MotionSensor extends SecurityDevice {
	public setupEvents(){
		/* InsteonDevice emits all packets with type & subtype
		   type 0x50 = Standard Message Received
		   subtype 0x06 = Broadcast (Physically Triggered) when the from address matches this device.
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], this.physicalEventEmitter);
	}
	
	private physicalEventEmitter(data: Packet.StandardMessageRecieved){
		switch(true){
			case data.cmd1 === 0x11 && data.cmd2 === 0x01: this.emitPhysical(['motion','on'], data); break;
			case data.cmd1 === 0x13 && data.cmd2 === 0x01: this.emitPhysical(['motion','off'], data); break;
			case data.cmd1 === 0x11 && data.cmd2 === 0x02: this.emitPhysical(['light','dusk'], data); break;
			case data.cmd1 === 0x13 && data.cmd2 === 0x02: this.emitPhysical(['light','dawn'], data); break;
			case data.cmd1 === 0x11 && data.cmd2 === 0x03: this.emitPhysical(['battery','low'], data); break; // not tested
			case data.cmd1 === 0x13 && data.cmd2 === 0x03: this.emitPhysical(['battery','normal'], data); break; // is this right?? not tested
			// default: console.log("Unknown Broadcast command",data.cmd1,data.cmd2);
		}
	}
	
	// Start device configuration methods
	/* Get the configuration flags from the device */
	public async configRequest(): Promise<Packet.StandardMessageRecieved>{
		return this.sendInsteonCommand(0x1F,0x00);
	}
	
	/* Parse the flags into an easy to use object
		Get Operating Flags: 0x1F, 0x00 -> Returned ACK will contain requested data in CMD2
		These settings do not appear to be used by the motion sensor.
		All configuration options are stored in the Extended Configuration
	 */
	public async readConfig(){
		// Getting configuration
		const configPacket = await this.configRequest();

		// Convert the flags stored in cmd2 to an array of bits
		// String to base2, pad leading 0s, then split into an array of ints. Reverse it so that the array index matches the bit index
		const bits = configPacket.cmd2.toString(2).padStart(8,"0").split("").reverse().map(bit => parseInt(bit));
		
		return {
			bits: bits,
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
	
	/* Extended Get
		cmd1: 0x2E
		cmd2: 0x00
		user data  1: 0x00-0xFF = target group/button. This class is for single group devices, so the button # is always the first one.
		user data  2: 0x00 = Data Request
		user data  3-14: 0x00 Unused

		Response:
		user data  2: 0x01 = Data Response to data request 0x00
		user data  3: 0x00 - 0xFF = LED Brightness
		user data  4: 0x00 - 0xFF = motionCountdown 0.5 up to 128 minutes in 30 second increments
		user data  5: 0x00 - 0xFF = Light Sensitivity
		user data  6: bits 1-4 Control onCommandsOnly, nightModeOnly, LEDEnabled, onlyAfterTimeoutDisabled
		user data  7: 
		user data  8: 
		user data  9: 
		user data 10:
		user data 11: light level?
		user data 12: battery?
		user data 13-14: Unused
	*/

	public extendedConfigRequest = () => new Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>((resolve, reject) => {
		// Catch the extended configuration data packet
		this.once(
			['p',PacketID.ExtendedMessageReceived.toString(16),0x00.toString(16)],
			(packet: Packet.ExtendedMessageRecieved) =>  resolve(packet)
		);
		
		this.sendInsteonCommand(0x2E, 0x00,[0x01,0x00]);
	});

	public async readExtendedConfig(){
		const packet = await this.extendedConfigRequest();
		const configBits = packet.extendedData[5].toString(2).padStart(8,"0").split("").reverse().map((bit: string) => parseInt(bit));

		return {
			extendedData: packet.extendedData,
			LEDBrightness: packet.extendedData[2],
			motionCountdown: packet.extendedData[3],
			lightSensitivity: packet.extendedData[4],
			configBits: configBits,
			onCommandsOnlyDisabled: configBits[1], // inverted
			nightOnlyModeDisabled: configBits[2], // inverted
			LEDEnabled: configBits[3],
			onlyAfterTimeoutDisabled: configBits[4]
		}
	}
	
	/* Extended Set:
		cmd1: 0x2E
		cmd2: 0x00
		user data  1: 0x00-0xFF = target button. Always using 0x01 in this class because these devices have a single button.
	*/
	
	public async setExtendedConfigFlag(setting: Byte, value: Byte): Promise<Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved>{
		const cmd1 = 0x2E;
		const cmd2 = 0x00;
		const extendedData = new Array(13).fill(0x00);
		extendedData[0] = 0x01;
		extendedData[1] = setting;
		extendedData[2] = value;
		extendedData.push(InsteonDevice.calulateChecksum(cmd1, cmd2, extendedData));
		
		return this.sendInsteonCommand(cmd1, cmd2, extendedData);
	}
	
	/*	Set LED Brightness
		user data  2: 0x02 = set LED Brightness
		user data  3: 0x00-0xFF = brightness value
		user data  4-14: Unused
	*/
	public async setLEDBrightness(level: Byte): Promise<Packet.StandardMessageRecieved>{
		return this.setExtendedConfigFlag(0x02, level);
	}

	/*	Set Motion Countdown duration
		user data  2: 0x03 = set Motion Countdown
		user data  3: 0x00-0xFF = Duration from 0.5 seconds to 128 minutes in 30 second increments
		user data  4-14: Unused
	*/
	public async setMotionCountdown(value: Byte): Promise<Packet.StandardMessageRecieved>{
		return this.setExtendedConfigFlag(0x03, value);
	}
	
	/* Set the light sensitivity 
		user data 2: 0x04 = set light sensitivity/threshold
		user data 3: 0x00 - 0xFF = threshold value
		user data 4-14: Unused
	*/
	public async setLightSensitivity(level: Byte): Promise<Packet.StandardMessageRecieved>{
		return this.setExtendedConfigFlag(0x04, level);
	}
	
	/* Set the configuration byte
		user data 2: 0x05 = set config byte
		user data 3: byte to set
		user data 4-14: unused

		The config flags in this byte are all set at once
		bit 2 = onCommandsOnlyDisabled
		bit 3 = nightOnlyModeDisabled
		bit 4 = LEDEnabled
		bit 5 = onlyAfterTimeoutDisabled
	*/
	public async setConfig(options: MotionSensorConfigOptions): Promise<Packet.StandardMessageRecieved>{
		let flagByte = 0x00;
		if(options.onCommandsOnlyDisabled)   flagByte |= 0x02; //0000 0010
		if(options.nightOnlyModeDisabled)    flagByte |= 0x04; //0000 0100
		if(options.LEDEnabled)               flagByte |= 0x08; //0000 1000  - this flag is inverted. Other devices use LED disabled instead of LED enabled
		if(options.onlyAfterTimeoutDisabled) flagByte |= 0x10; //0001 0000
		
		return this.setExtendedConfigFlag(0x05, flagByte as Byte);
	}
	
}