/* Libraries */
import SecurityDevice from './SecurityDevice';
import { Packet, Byte, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Class */
export default class OpenCloseSensor extends SecurityDevice {
	public setupEvents(){
		/* InsteonDevice emits all packets with type & subtype
		   type 0x50 = Standard Message Received
		   subtype 0x06 = Broadcast (Physically Triggered) when the from address matches this device.
		 */
		this.on(['p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.GroupBroadcastMessage.toString(16)], this.physicalEventEmitter);
	}
	
	private physicalEventEmitter(data: Packet.StandardMessageRecieved){
		switch(true){
			case data.cmd1 === 0x11 && data.cmd2 === 0x01: this.emitPhysical(['sensor','opened'], data); break;
			case data.cmd1 === 0x13 && data.cmd2 === 0x01: this.emitPhysical(['sensor','closed'], data); break;
			case data.cmd1 === 0x11 && data.cmd2 === 0x03: this.emitPhysical(['battery','opened'], data); break; // not tested
			case data.cmd1 === 0x13 && data.cmd2 === 0x03: this.emitPhysical(['battery','closed'], data); break; // not tested
			case data.cmd1 === 0x11 && data.cmd2 === 0x04: this.emitPhysical(['heartbeat','opened'], data); break; // not tested
			case data.cmd1 === 0x13 && data.cmd2 === 0x04: this.emitPhysical(['heartbeat','closed'], data); break; // not tested
			// default: console.log("Unknown Broadcast command",data.cmd1,data.cmd2);
		}
	}
}