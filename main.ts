let sendBluetooth = false;
let sendUSB = false;
let lastReceivedString: String = null;
pfTransmitter.connectIrSenderLed(AnalogPin.P2)
bluetooth.startUartService()
let engine1 = 0
let engine2 = 0
let interval = 500
let legoMode = 0

basic.showIcon(IconNames.Square)

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
    sendDataHeader()
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
    public key: string;
    public getData: () => number;
    public interval: number;
    public lastCheck: number;
    public value: number;
    public lastValue: number;
    public status: boolean;
    private isRunning: boolean;
    public delta: number;
    private condition: (value: number, lastValue: number) => boolean;

    constructor(key: string, interval: number, getData: () => number, delta: number = -1, condition: (value: number, lastValue: number) => boolean = null) {
        this.key = key;
        this.interval = interval;
        this.getData = getData;
        this.delta = delta;
        this.condition = condition;
        this.key = key;
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

        if (typeof this.condition == 'function' && !this.condition(this.value, this.lastValue)){
            changed = false;
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

function getSensorByKey(key: string): Sensor {
    return measurements.filter(s => {
        return s.key == key
    })[0]
}

let bluetoothLastSendTime = 0;
let bluetoothSendInterval = 500;
let webUSBLastSendTime = 0;
let webUSBSendInterval = 500;
let changed = false;
let sendTime = 0;
basic.forever(() => {
    let now = input.runningTime();
    let out: number[] = [now]

    for (let sensor of measurements) {
        if (sensor.status && now >= (sensor.interval + sensor.lastCheck)) {
            changed = changed || sensor.check()
        }
        out.push(sensor.value != null ? sensor.value : 0)
    }

    if (changed) {
        changed = false

        if (sendBluetooth && now > bluetoothLastSendTime + bluetoothSendInterval) {
            bluetoothLastSendTime = now
            out.push(bluetoothLastSendTime)
            out.push(bluetoothSendInterval)
            // out.push(sendTime)
            // sendTime = input.runningTime()
            bluetooth.uartWriteString(out.join(',') + '\n')
            // sendTime = input.runningTime() - sendTime
        }
        
        if (sendUSB && now > webUSBLastSendTime + webUSBSendInterval) {
            webUSBLastSendTime = now
            out.push(webUSBLastSendTime)
            out.push(webUSBSendInterval)
            serial.writeNumbers(out)
        }
    }
})

function onDisconnect(){
    for (let sensor of measurements) {
        sensor.status = false;
    }
}

function sendDataHeader() {
    let out: string[] = ['time']

    for (let sensor of measurements) {
        out.push(sensor.key)
    }

    if (sendBluetooth){
        bluetooth.uartWriteString(out.join(',') + '\n')
    }
}

// Temperature
measurements.push(new Sensor('temp', 1000, () => {
    return input.temperature()
}, 0))

// Light
measurements.push(new Sensor('light', 1000, () => {
    return input.lightLevel()
}, 10))

// Acceleration X
measurements.push(new Sensor('ax', 1000, () => {
    return input.acceleration(Dimension.X)
}, 10))

// Acceleration Y
measurements.push(new Sensor('ay', 1000, () => {
    return input.acceleration(Dimension.Y)
}, 10))

// Sound
measurements.push(new Sensor('sound', 1000, () => {
    return input.soundLevel()
}, 10))

// Rand
measurements.push(new Sensor('rand', 1000, () => {
    return Math.randomRange(0, 100)
}, 0))

// Compas
// measurements.push(new Sensor('compas', 500, () => {
//     return input.compassHeading()
// }, 0))

// Sonar
// measurements.push(new Sensor('sonar', 500, () => {
//     return sonar.ping(DigitalPin.P2, DigitalPin.P1, PingUnit.Centimeters)
// }))


function messageHandler(receivedString: String){
    let data = receivedString.split(';')

    if (data[0] == 'usbOn') {
        sendUSB = true
        return
    } else if (data[0] == 'usbOff') {
        sendUSB = false
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

    let sensor = getSensorByKey(data[0]);
    if (sensor) {
        if (data[1] == 'get'){
            let settings = sensor.getSettings();

            if (sendBluetooth) {
                bluetooth.uartWriteString(settings.join(',') + '\n')
            }

            if (sendUSB) {
                serial.writeNumbers(settings)
            }
        } else {
            let settings = data.slice(1).map(x => {return +x})
            sensor.settings(settings)
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