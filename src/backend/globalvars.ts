
import { BrowserWindow } from 'electron';

interface GlobalVars {
    mainWindow: BrowserWindow | undefined;
}

const globalvars: GlobalVars = {
    mainWindow: undefined 
};

export default globalvars;

