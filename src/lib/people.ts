export type Person = { id: string; name: string; relation?: string; file: string };

export const PEOPLE: Person[] = [
  { id: "akhil", name: "Akhil", relation: "friend", file: "/people/akhil.jpeg" },
  { id: "pradeep", name: "Pradeep", relation: "friend", file: "/people/pradeep.jpeg" },
  { id: "akash", name: "Akash", relation: "friend", file: "/people/akash.jpeg" },
  { id: "sivanagu", name: "Siva Nagu", relation: "friend", file: "/people/sivanagu.jpeg" },
  { id: "ramteja", name: "Ramteja", relation: "friend", file: "/people/ramteja.jpeg" },
  { id: "murali", name: "Murali", relation: "friend", file: "/people/murali.jpeg" },
  { id: "ramayya", name: "Ramayya", relation: "friend", file: "/people/ramayya.jpeg" },
];

export function peopleRefsForOrigin(origin: string) {
  return PEOPLE.map((p) => ({ name: p.name, url: `${origin}${p.file}` }));
}