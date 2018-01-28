/* Libraries */
import {InsteonDevice} from './InsteonDevice';
import {PLM} from '../main';

/* Types */
import {Byte} from '../typings/typings';

/* Class */
export class SwitchLincDimmer extends InsteonDevice{
	constructor(deviceID: Byte[], modem: PLM){
		super(deviceID, modem);


	}
}