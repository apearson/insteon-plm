/* Libraries */
import InsteonDevice from './InsteonDevice';
import PLM from '../main';

/* Types */
import { Byte, Packets, PacketID, MessageSubtype } from 'insteon-packet-parser';

/* Class */
export default class OutletLinc extends InsteonDevice{
	constructor(deviceID: Byte[], modem: PLM){
		super(deviceID, modem);
	}

	public getInsteonEngineVersion = () => new Promise<Packets.StandardMessageRecieved>((resolve, reject) => {

		// Setting up command
		const id = this.addressString;
		const cmd1 = 0x09;
		const cmd2 = 0x01;

		this.modem.once([
			'p', PacketID.StandardMessageReceived.toString(16), MessageSubtype.ACKofDirectMessage.toString(16), id], 
			(data: Packets.StandardMessageRecieved)=> resolve(data)
		);

		// Starting linking 
		this.modem.sendStandardCommand(this.address, 0x0F, cmd1, cmd2);
	});

}