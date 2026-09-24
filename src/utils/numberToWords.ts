export function numberToWords(num: number): string {
  if (num === 0) return "Zero";

  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const inWords = (n: number): string => {
    let str = "";
    if (n > 99) {
      str += a[Math.floor(n / 100)] + "Hundred ";
      n = n % 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + " ";
      n = n % 10;
    }
    if (n > 0) {
      str += a[n];
    }
    return str;
  };

  const wholeNum = Math.floor(num);
  let decimalStr = "";
  const decimals = Math.round((num - wholeNum) * 100);
  if (decimals > 0) {
    decimalStr = " and " + inWords(decimals).trim() + " Paise";
  }

  if (wholeNum === 0) {
    return (decimalStr.trim() + " Only").trim();
  }

  let word = "";
  let temp = wholeNum;

  // Crores
  if (Math.floor(temp / 10000000) > 0) {
    word += inWords(Math.floor(temp / 10000000)) + "Crore ";
    temp %= 10000000;
  }
  // Lakhs
  if (Math.floor(temp / 100000) > 0) {
    word += inWords(Math.floor(temp / 100000)) + "Lakh ";
    temp %= 100000;
  }
  // Thousands
  if (Math.floor(temp / 1000) > 0) {
    word += inWords(Math.floor(temp / 1000)) + "Thousand ";
    temp %= 1000;
  }
  // Units
  if (temp > 0) {
    word += inWords(temp);
  }

  return "Rupees " + word.trim() + decimalStr + " Only";
}
