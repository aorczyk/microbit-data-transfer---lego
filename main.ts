let sendBluetooth = false;
let sendUSB = false;
let legoMode = 0

pfTransmitter.connectIrSenderLed(AnalogPin.P2)
bluetooth.startUartService()

basic.showIcon(IconNames.Square)

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
    sendBluetooth = true;
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
    sendBluetooth = false;
    onDisconnect()
})

input.onButtonPressed(Button.A, function () {
    sendBluetooth = !sendBluetooth;
})

input.onButtonPressed(Button.B, function () {
    sendUSB = !sendUSB;
})

input.onButtonPressed(Button.AB, function () {
    legoMode += 1;

    if (legoMode > 1){
        legoMode = 0
    }

    basic.showNumber(legoMode)
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
    }

    public check(): boolean {
        this.lastValue = this.value
        let value = this.getData()

        this.lastCheck = input.runningTime();
        let changed = true;

        if (this.delta != -1 && this.value != null){
            if (value > (this.value + this.delta) || value < (this.value - this.delta)) {
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
            out.push(0)
        }
    }

    if (changed) {
        changed = false

        if (sendBluetooth && now > bluetoothLastSendTime + bluetoothSendInterval) {
            bluetoothLastSendTime = now
            bluetooth.uartWriteString(out.join(',') + '\n')
        }
        
        if (sendUSB && now > webUSBLastSendTime + webUSBSendInterval) {
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
let engine1 = 0
let engine2 = 0

function messageHandler(receivedString: String){
    let data = receivedString.split(';')

    if (data[0] == 'usbOn') {
        sendUSB = true
        basic.showIcon(IconNames.Yes)
        return
    } else if (data[0] == 'usbOff') {
        sendUSB = false
        basic.showIcon(IconNames.Square)
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

        if (sendBluetooth) {
            bluetooth.uartWriteString(settings.join(',') + '\n')
        }

        if (sendUSB) {
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

        if (legoMode == 0){
            let engine1New = 0
            let engine2New = 0

            let keys = receivedString.split(';').map(x => +x)

            for (let key of keys) {
                if (!engine1New && (key == 38 || key == 40 || key == 32)) {
                    engine1New = key
                } else if (!engine2New && (key == 37 || key == 39)) {
                    engine2New = key
                }
            }

            if (engine1 != engine1New) {
                engine1 = engine1New

                if (engine1 == 32) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.BrakeThenFloat)
                } else if (engine1 == 38) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Backward7)
                } else if (engine1 == 40) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Forward7)
                } else {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Red, PfSingleOutput.Float)
                }
            }

            if (engine2 != engine2New) {
                engine2 = engine2New

                if (engine2 == 39) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Backward7)
                } else if (engine2 == 37) {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Forward7)
                } else {
                    pfTransmitter.singleOutputMode(PfChannel.Channel2, PfOutput.Blue, PfSingleOutput.Float)
                }
            }
        }

        if (legoMode == 1) {
            if (receivedString == "38;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward7)
            } else if (receivedString == "39;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward5)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward5)
            } else if (receivedString == "37;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward5)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward5)
            } else if (receivedString == "40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward7)
            } else if (receivedString == "38;39;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward2)
            } else if (receivedString == "37;38;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Backward2)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Forward7)
            } else if (receivedString == "37;40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward2)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward7)
            } else if (receivedString == "39;40;") {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Forward7)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Backward2)
            } else {
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Red, PfSingleOutput.Float)
                pfTransmitter.singleOutputMode(PfChannel.Channel1, PfOutput.Blue, PfSingleOutput.Float)
            }
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

// Acceleration X
measurements[3] = new Sensor(() => {
    return input.acceleration(Dimension.X)
}, 10)

// Acceleration Y
measurements[4] = new Sensor(() => {
    return input.acceleration(Dimension.Y)
}, 10)

// Sound
measurements[5] = new Sensor(() => {
    return input.soundLevel()
}, 10)

// Random numbers
measurements[6] = new Sensor(() => {
    return Math.randomRange(0, 100)
}, 0)

// Acceleration Z
measurements[7] = new Sensor(() => {
    return input.acceleration(Dimension.Z)
}, 10)

// // Compas
// // measurements[8] = new Sensor(() => {
// //     return input.compassHeading()
// // }, 20)

// // Sonar
// // measurements[9] = new Sensor(() => {
// //     return sonar.ping(DigitalPin.P2, DigitalPin.P1, PingUnit.Centimeters)
// // })