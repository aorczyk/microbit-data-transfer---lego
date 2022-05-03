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
    public values: number[];
    public status: boolean;
    public delta: number;

    constructor(getData: () => number, delta: number = -1, interval: number = 1000) {
        this.interval = interval;
        this.getData = getData;
        this.delta = delta;
        this.lastCheck = input.runningTime();
        this.status = false;
        this.value = null;
        this.values = [];
    }

    public check(): void {
        this.lastCheck = input.runningTime();
        this.values.push(this.getData())
    }

    public get(): number {
        let value = null;

        if (this.interval == -1){
            value = this.getData()
        } else if (this.values.length) {
            value = this.values.reduce((a, b) => a + b, 0) / this.values.length;
            value = Math.round(value * 10) / 10
            this.values = []
        }

        if (value !== null){
            if (this.delta != -1) {
                if (Math.abs(this.value - value) > this.delta) {
                    this.value = value;
                } else if (this.value != 0 && value == 0) {
                    this.value = 0;
                }
            } else {
                this.value = value;
            }
        }

        return this.value
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
        return [0, this.status ? 1 : 0, this.interval, this.delta]
    }
}

let measurements: Sensor[] = [];

let bluetoothLastSendTime = 0;
let bluetoothSendInterval = 500;
let webUSBLastSendTime = 0;
let webUSBSendInterval = 500;
let lastOut = '';

function getDataLine() {
    let out: number[] = []

    for (let c = 1; c < measurements.length; c++) {
        let sensor = measurements[c]
        if (sensor) {
            out.push(sensor.get())
        } else {
            out.push(0)
        }
    }

    return out
}

basic.forever(() => {
    let now = input.runningTime();
    let sensorsNr = measurements.length;

    for (let c = 1; c < sensorsNr; c++) {
        let sensor = measurements[c]
        if (sensor && sensor.interval != -1){
            if (sensor.status && now >= (sensor.interval + sensor.lastCheck)) {
                sensor.check()
            }
        }
    }

    if ((bluetoothEnabled && now > bluetoothLastSendTime + bluetoothSendInterval) || (webUsbEnabled && now > webUSBLastSendTime + webUSBSendInterval)) {
        let out = getDataLine()
        let outStr = out.join(',');

        if (outStr != lastOut){
            out.unshift(input.runningTime());

            if (bluetoothEnabled){
                lastOut = outStr
                bluetoothLastSendTime = now
                bluetooth.uartWriteString(out.join(',') + '\n')
            }

            if (webUsbEnabled){
                lastOut = outStr
                webUSBLastSendTime = now
                serial.writeNumbers(out)
            }
        }
    }
})

function onDisconnect(){
    for (let sensor of measurements) {
        if (sensor){
            sensor.status = false;
            sensor.values = [];
            sensor.value = null;
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

    if (data[0] == 'getSettings'){
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

    if (data[0] == 'get'){
        let out = getDataLine()
        out.unshift(input.runningTime());

        if (bluetoothEnabled){
            bluetooth.uartWriteString(out.join(',') + '\n')
        }

        if (webUsbEnabled){
            serial.writeNumbers(out)
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

// Compass
measurements[7] = new Sensor(() => {
    return input.compassHeading()
}, 20)

// // Random numbers
// measurements[8] = new Sensor(() => {
//     return Math.randomRange(0, 100)
// }, 0)