let sendBluetooth = true;
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
    sendBluetooth = true;
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
    sendBluetooth = false;
})

input.onButtonPressed(Button.A, function () {
    sendBluetooth = !sendBluetooth;
})

input.onButtonPressed(Button.B, function () {
    sendUSB = !sendUSB;
    serial.writeNumbers([10])
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

    constructor(key: string, interval: number, getData: () => number, delta: number = null, condition: (value: number, lastValue: number) => boolean = null) {
        this.key = key;
        this.interval = interval;
        this.getData = getData;
        this.delta = delta;
        this.condition = condition;
        this.key = key;
        this.lastCheck = input.runningTime();
        this.status = true;
    }

    public check(): boolean {
        this.lastValue = this.value
        let value = this.getData()

        this.lastCheck = input.runningTime();
        let changed = true;

        if (this.delta != null && this.value != null){
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
}

let measurements: Sensor[] = [];

function getSesorByKey(key: string): Sensor {
    return measurements.filter(s => {
        return s.key == key
    })[0]
}

basic.forever(() => {
    let changed = false;
    let now = input.runningTime();
    let out: number[] = [now]

    for (let sensor of measurements) {
        // serial.writeString([now, sensor.status ? 1 : 0, sensor.interval, sensor.lastCheck].join(',') + '\n')
        if (sensor.status && now >= (sensor.interval + sensor.lastCheck)) {
            changed = changed || sensor.check()
        }

        out.push(sensor.value)
    }

    if (changed) {
        serial.writeNumbers(out)
        if (sendBluetooth) {
            bluetooth.uartWriteString(out.join(',') + '\n')
        } else if (sendUSB) {
            serial.writeNumbers(out)
        }
    }
})

// Temperature
measurements.push(new Sensor('temp', 2000, () => {
    return input.temperature()
}, 0))

// Light
measurements.push(new Sensor('light', 1000, () => {
    return input.lightLevel()
}, 10))

// Light
measurements.push(new Sensor('ax', 1000, () => {
    return input.acceleration(Dimension.X)
}, 10))

// Sonar
// measurements.push(new Sensor('sonar', 500, () => {
//     return sonar.ping(DigitalPin.P2, DigitalPin.P1, PingUnit.Centimeters)
// }))


function messageHandler(receivedString: String){
    let data = receivedString.split(';')

    if (data.length == 1) {
        // music.playTone(Note.C, music.beat())
        basic.showString(data[0])
        return
    }

    if (data[0] == 'WebUSB') {
        if (+data[1]) {
            sendUSB = true;
        } else {
            sendUSB = false;
        }
        return
    }

    let sensor = getSesorByKey(data[0]);
    if (sensor) {
        let status = data[1]
        if (+status) {
            sensor.status = true
        } else {
            sensor.status = false
        }

        if (data.length > 2){
            sensor.interval = +data[2];

            if (data[3] == '') {
                sensor.delta = null
            } else {
                sensor.delta = +data[3]
            }
        }

        return
    }

    if (data[0] == 'str') {
        // music.playTone(Note.C, music.beat())
        basic.showString(data[1])
        // basic.showIcon(0)
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

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function() {
    let receivedString = serial.readUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})