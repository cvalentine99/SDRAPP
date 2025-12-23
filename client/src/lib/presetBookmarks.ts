export interface PresetBookmark {
  name: string;
  frequency: string;
  description: string;
  category: string;
}

export interface BookmarkPack {
  id: string;
  name: string;
  description: string;
  bookmarks: PresetBookmark[];
}

export const PRESET_PACKS: BookmarkPack[] = [
  {
    id: "amateur-radio",
    name: "Amateur Radio Bands",
    description: "Common amateur radio frequencies and calling frequencies",
    bookmarks: [
      {
        name: "2m FM Calling",
        frequency: "146.52",
        description: "2-meter FM simplex calling frequency (North America)",
        category: "Amateur",
      },
      {
        name: "70cm FM Calling",
        frequency: "446.0",
        description: "70-centimeter FM simplex calling frequency (North America)",
        category: "Amateur",
      },
      {
        name: "6m SSB Calling",
        frequency: "50.125",
        description: "6-meter SSB calling frequency",
        category: "Amateur",
      },
      {
        name: "10m FM Calling",
        frequency: "29.6",
        description: "10-meter FM calling frequency",
        category: "Amateur",
      },
      {
        name: "1.25m FM Calling",
        frequency: "223.5",
        description: "1.25-meter (220 MHz) FM calling frequency",
        category: "Amateur",
      },
      {
        name: "33cm FM Calling",
        frequency: "927.5",
        description: "33-centimeter (900 MHz) FM calling frequency",
        category: "Amateur",
      },
      {
        name: "23cm FM Calling",
        frequency: "1294.5",
        description: "23-centimeter (1.2 GHz) FM calling frequency",
        category: "Amateur",
      },
    ],
  },
  {
    id: "aviation",
    name: "Aviation Frequencies",
    description: "Air traffic control, emergency, and navigation frequencies",
    bookmarks: [
      {
        name: "VHF Guard",
        frequency: "121.5",
        description: "International aeronautical emergency frequency",
        category: "Aviation",
      },
      {
        name: "UHF Guard",
        frequency: "243.0",
        description: "Military emergency frequency",
        category: "Aviation",
      },
      {
        name: "Tower Common",
        frequency: "118.0",
        description: "Common tower frequency (varies by airport)",
        category: "Aviation",
      },
      {
        name: "Ground Control",
        frequency: "121.9",
        description: "Typical ground control frequency",
        category: "Aviation",
      },
      {
        name: "ATIS",
        frequency: "126.25",
        description: "Automatic Terminal Information Service (common)",
        category: "Aviation",
      },
      {
        name: "Unicom",
        frequency: "122.8",
        description: "Aeronautical advisory station frequency",
        category: "Aviation",
      },
      {
        name: "Air-to-Air",
        frequency: "122.75",
        description: "Private aircraft air-to-air communication",
        category: "Aviation",
      },
    ],
  },
  {
    id: "ism-bands",
    name: "ISM Bands",
    description: "Industrial, Scientific, and Medical unlicensed bands",
    bookmarks: [
      {
        name: "ISM 433 MHz",
        frequency: "433.92",
        description: "433 MHz ISM band (Europe, Asia)",
        category: "ISM",
      },
      {
        name: "ISM 868 MHz",
        frequency: "868.0",
        description: "868 MHz ISM band (Europe)",
        category: "ISM",
      },
      {
        name: "ISM 915 MHz",
        frequency: "915.0",
        description: "915 MHz ISM band (Americas, Australia)",
        category: "ISM",
      },
      {
        name: "ISM 2.4 GHz Low",
        frequency: "2400.0",
        description: "2.4 GHz ISM band lower edge (WiFi, Bluetooth, Zigbee)",
        category: "ISM",
      },
      {
        name: "ISM 2.4 GHz Center",
        frequency: "2450.0",
        description: "2.4 GHz ISM band center frequency",
        category: "ISM",
      },
      {
        name: "ISM 2.4 GHz High",
        frequency: "2483.5",
        description: "2.4 GHz ISM band upper edge",
        category: "ISM",
      },
      {
        name: "ISM 5.8 GHz",
        frequency: "5800.0",
        description: "5.8 GHz ISM band (WiFi, cordless phones)",
        category: "ISM",
      },
    ],
  },
  {
    id: "satellite",
    name: "Satellite Downlinks",
    description: "Weather satellites, amateur satellites, and space communications",
    bookmarks: [
      {
        name: "NOAA 15 APT",
        frequency: "137.62",
        description: "NOAA 15 weather satellite APT downlink",
        category: "Satellite",
      },
      {
        name: "NOAA 18 APT",
        frequency: "137.9125",
        description: "NOAA 18 weather satellite APT downlink",
        category: "Satellite",
      },
      {
        name: "NOAA 19 APT",
        frequency: "137.1",
        description: "NOAA 19 weather satellite APT downlink",
        category: "Satellite",
      },
      {
        name: "METEOR-M2 LRPT",
        frequency: "137.1",
        description: "METEOR-M2 weather satellite LRPT downlink",
        category: "Satellite",
      },
      {
        name: "ISS Voice",
        frequency: "145.8",
        description: "International Space Station voice downlink",
        category: "Satellite",
      },
      {
        name: "ISS Packet",
        frequency: "145.825",
        description: "ISS APRS packet radio downlink",
        category: "Satellite",
      },
      {
        name: "SO-50 Downlink",
        frequency: "436.795",
        description: "SO-50 amateur satellite FM downlink",
        category: "Satellite",
      },
      {
        name: "AO-91 Downlink",
        frequency: "145.96",
        description: "AO-91 (RadFxSat) amateur satellite downlink",
        category: "Satellite",
      },
    ],
  },
];
