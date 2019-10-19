/* Libraries */
import InsteonDevice from '../InsteonDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Base class for device category 0x01 - Dimmable Lighting Control
   All dimmable controls including switches, outlets and plugin modules live here
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
				case 0x13: this.emitPhysical(['switch','off'], data); break; //console.log("Physically turned Off"); break;
				case 0x12: this.emitPhysical(['switch','fastOn'], data); break; //console.log("Physically Fast On"); break;
				case 0x14: this.emitPhysical(['switch','fastOff'], data); break; //console.log("Physically Fast Off"); break;
				case 0x17:
					switch(Number(data.cmd2)){
						case 0x0: this.emitPhysical(['dim','startDimming'], data); break;
						case 0x1: this.emitPhysical(['dim','startBrigthening'], data); break;
					}
					break;
				case 0x18: this.emitPhysical(['dim','stoppedChanging'], data); break;
				// default: console.log("Uknown Broadcast command",data.cmd1,data.cmd2);
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
				// default: console.log("Uknown Ack Command",data.cmd1,data.cmd2);
			}
		});
	}
	
	/* Event Emitter functions */
	private emitPhysical(event: string[], data: Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved){
		event.push("physical");
		this.emit(event, data);
		
		if(this.options.debug)
			console.log(`emit physical ${event.join(".")}; cmd2: ${data.cmd2}`);

	}
	
	/* Remote means acknowledgement: a command was received by the device from another device */
	private emitRemote(event: string[], data: Packet.StandardMessageRecieved | Packet.ExtendedMessageRecieved){
		event.push("remote");
		this.emit(event, data);
		
		if(this.options.debug)
			console.log(`emit remote ${event.join(".")}; cmd2: ${data.cmd2}`);
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
