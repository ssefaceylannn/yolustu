import type { Vehicle } from "./types";

const CAR = ["Fiat", "Ford", "Mercedes-Benz", "Volkswagen", "Renault", "Peugeot", "Citroën", "Iveco", "Opel", "Toyota", "Hyundai", "Kia", "Dacia", "Nissan", "Honda", "BMW", "Audi", "Škoda", "SEAT", "Cupra", "Volvo", "Mitsubishi", "Isuzu", "Land Rover", "Jeep", "Suzuki", "Mazda", "Subaru", "Tesla", "Togg", "BYD", "MG", "Chery", "Porsche", "Lexus", "MINI", "Alfa Romeo", "Ssangyong", "Chevrolet"];
const CARAVAN = ["Hymer", "Knaus", "Adria", "Dethleffs", "Bürstner", "Hobby", "Weinsberg", "Sun Living", "Carado", "Pilote", "Rapido", "Chausson", "Benimar", "Roller Team", "Laika", "Westfalia", "Pössl", "LMC", "Fendt", "Tabbert", "Caravelair", "Sterckeman", "Eriba", "Fiat", "Ford", "Mercedes-Benz", "Volkswagen", "Renault", "Peugeot", "Citroën", "Iveco"];
const MOTO = ["Yamaha", "Honda", "BMW", "KTM", "Kawasaki", "Suzuki", "Harley-Davidson", "Ducati", "Triumph", "Royal Enfield", "CFMoto", "Bajaj", "Mondial", "Kuba", "Benelli", "Aprilia", "Husqvarna", "Piaggio", "Vespa", "SYM", "Kymco"];

export function brandsFor(kind: Vehicle["kind"]) {
  if (kind === "motorcycle") return MOTO;
  if (kind === "motorhome" || kind === "caravan") return CARAVAN;
  return CAR;
}
