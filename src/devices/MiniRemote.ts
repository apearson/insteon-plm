/* Libraries */
import {InsteonDevice} from './InsteonDevice';
import {PLM, Packets} from '../main';

/* Types */
import {Byte} from '../typings/typings';

/* Class */
export class MiniRemote extends InsteonDevice{
	constructor(deviceID: Byte[], modem: PLM){
		super(deviceID, modem);

		/* Handling all packets */
		modem.on(`${this.addressString}.*`, this.handlePacket.bind(this));
	}

	private handlePacket(packet: Packets.Packet){

		const state = packet.cmd1 === 0x11;

		if(packet.type == 80 && packet.subtype == 6){
			let state = null;
			if(packet.cmd1 === 0x11 || packet.cmd1 === 0x13){
				state = packet.cmd1 === 0x11;
			}

			console.log(`${this.addressString}: Got button press ${packet.to[2]} changing to ${state}`);
		}
	}

}