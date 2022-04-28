let bluetoothEnabled = false;
let webUsbEnabled = false;

bluetooth.startUartService()

basic.showIcon(IconNames.Square)

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
    bluetoothEnabled = false;
    onDisconnect()
})

input.onButtonPressed(Button.A, function () {
    bluetoothEnabled = !bluetoothEnabled;
})

input.onButtonPressed(Button.B, function () {
    webUsbEnabled = !webUsbEnabled;
})

class Sensor {
    public getData: () => number;
    public interval: number;
    public lastCheck: number;
    public value: number;
    public lastValue: number;
    public status: boolean;
    public delta: number;

    constructor(getData: () => number, delta: number = -1, interval: number = 1000) {
        this.interval = interval;
        this.getData = getData;
        this.delta = delta;
        this.lastCheck = input.runningTime();
        this.status = false;
        this.value = null;
    }

    public check(): boolean {
        this.lastValue = this.value
        let value = this.getData()

        this.lastCheck = input.runningTime();
        let changed = true;

        if (this.delta != -1 && this.value != null){
            if (Math.abs(this.value - value) > this.delta) {
                this.value = value;
            } else if (this.value != 0 && value == 0){
                this.value = value;
            } else {
                changed = false;
            }
        } else {
            this.value = value;
        }

        return changed;
    }

    public settings(settings: number[]): void {
        if (settings[0] != null) {
            this.status = settings[0] == 1 ? true : false
        }

        if (settings[1] != null){
            this.interval = settings[1]
        }

        if (settings[2] != null) {
            this.delta = settings[2]
        }
    }

    public getSettings(){
        return [this.status ? 1 : 0, this.interval, this.delta]
    }
}

let measurements: Sensor[] = [];

let bluetoothLastSendTime = 0;
let bluetoothSendInterval = 500;
let webUSBLastSendTime = 0;
let webUSBSendInterval = 500;
let changed = false;
let sendTime = 0;

basic.forever(() => {
    let now = input.runningTime();
    let out: number[] = [now]

    for (let c = 1; c < measurements.length; c++) {
        let sensor = measurements[c]
        if (sensor){
            if (sensor.status && now >= (sensor.interval + sensor.lastCheck)) {
                changed = changed || sensor.check()
            }
            out.push(sensor.value != null ? sensor.value : 0)
        } else {
            out.push(null)
        }
    }

    if (changed) {
        changed = false

        if (bluetoothEnabled && now > bluetoothLastSendTime + bluetoothSendInterval) {
            bluetoothLastSendTime = now
            bluetooth.uartWriteString(out.join(',') + '\n')
        }
        
        if (webUsbEnabled && now > webUSBLastSendTime + webUSBSendInterval) {
            webUSBLastSendTime = now
            serial.writeNumbers(out)
        }
    }
})

function onDisconnect(){
    for (let sensor of measurements) {
        if (sensor){
            sensor.status = false;
        }
    }
}

let lastReceivedString: String = null;

function messageHandler(receivedString: String){
    let data = receivedString.split(';')

    if (data[0] == 'usbOn') {
        webUsbEnabled = true
        return
    } else if (data[0] == 'usbOff') {
        webUsbEnabled = false
        onDisconnect()
        return
    }

    if (data[0] == 'btOn') {
        bluetoothEnabled = true
        return
    } else if (data[0] == 'btOff') {
        bluetoothEnabled = false
        onDisconnect()
        return
    }

    if (data[0] == 'usb') {
        if (+data[1]) {
            webUSBSendInterval = +data[1]
        }

        return
    }

    if (data[0] == 'bt') {
        if (+data[1]) {
            bluetoothSendInterval = +data[1]
        }

        return
    }

    
    if (data[0] == 'set') {
        let sensor = measurements[+data[1]];
        if (sensor){
            let settings = data.slice(2).map(x => {return +x})
            sensor.settings(settings)
        }
        
        return
    }

    if (data[0] == 'get'){
        let sensor = measurements[+data[1]];
        let settings = sensor.getSettings();

        if (bluetoothEnabled) {
            bluetooth.uartWriteString(settings.join(',') + '\n')
        }

        if (webUsbEnabled) {
            serial.writeNumbers(settings)
        }

        return
    }

    if (data.length == 1) {
        // music.playTone(Note.C, music.beat())
        basic.showString(data[0])
        return
    }

    if (lastReceivedString != receivedString) {
        lastReceivedString = receivedString
        basic.clearScreen()

        if (receivedString == "38;") {
            led.plot(2, 0)
        } else if (receivedString == "39;") {
            led.plot(4, 2)
        } else if (receivedString == "37;") {
            led.plot(0, 2)
        } else if (receivedString == "40;") {
            led.plot(2, 4)
        } else if (receivedString == "38;39;") {
            led.plot(4, 0)
        } else if (receivedString == "37;38;") {
            led.plot(0, 0)
        } else if (receivedString == "37;40;") {
            led.plot(0, 4)
        } else if (receivedString == "39;40;") {
           led.plot(4, 4)
        } else {
            led.plot(2, 2)
        }
    }
}

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = serial.readUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})


// Temperature
measurements[1] = new Sensor(() => {
    return input.temperature()
}, 0)

// Light
measurements[2] = new Sensor(() => {
    return input.lightLevel()
}, 10)

// Sound
measurements[3] = new Sensor(() => {
    return input.soundLevel()
}, 10)

// Acceleration X
measurements[4] = new Sensor(() => {
    return input.acceleration(Dimension.X)
}, 10)

// Acceleration Y
measurements[5] = new Sensor(() => {
    return input.acceleration(Dimension.Y)
}, 10)

// Acceleration Z
measurements[6] = new Sensor(() => {
    return input.acceleration(Dimension.Z)
}, 10)

// // Compas
// // measurements[7] = new Sensor(() => {
// //     return input.compassHeading()
// // }, 20)

// Random numbers
measurements[8] = new Sensor(() => {
    return Math.randomRange(0, 100)
}, 0)