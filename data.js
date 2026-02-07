// =============================================
// بيانات العائلة
// جميع الأشخاص في النظام
// =============================================

const initialFamilyData = {
  p1: {
    id: "p1",
    name: "الغوث ولد الشيخ",
    gender: "male",
    dates: "",
    familyId: "p1",
    spouseIds: ["p2", "p6"],
    spouseId: "p2",
    childrenIds: ["p4"],
  },
  p2: {
    id: "p2",
    name: "صفية منت محمد سالم",
    gender: "female",
    dates: "",
    fatherId: "p3",
    familyId: "p3",
    childrenIds: ["p4"],
    spouseId: "p1",
  },
  p3: {
    id: "p3",
    name: "محمد سالم ولد زين",
    gender: "male",
    dates: "",
    familyId: "p3",
    spouseId: "p5",
    childrenIds: ["p2", "p6"],
  },
  p4: {
    id: "p4",
    name: "محمد ولد الغوث",
    gender: "male",
    dates: "",
    fatherId: "p1",
    motherId: "p2",
    familyId: "p1",
    childrenIds: [],
  },
  p5: {
    id: "p5",
    name: "حاج منت ديدي",
    gender: "female",
    spouseId: "p3",
    childrenIds: ["p6", "p2"],
  },
  p6: {
    id: "p6",
    name: "تسلم منت محمد سالم",
    gender: "female",
    familyId: "p3",
    spouseId: "p1",
    fatherId: "p3",
    motherId: "p5",
    childrenIds: [],
  },
};
