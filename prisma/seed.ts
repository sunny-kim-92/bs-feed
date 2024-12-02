import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const isoLanguageCodes = [
    { code: "aa" }, { code: "ab" }, { code: "ae" }, { code: "af" }, { code: "ak" }, 
    { code: "am" }, { code: "an" }, { code: "ar" }, { code: "as" }, { code: "av" }, 
    { code: "ay" }, { code: "az" }, { code: "ba" }, { code: "be" }, { code: "bg" }, 
    { code: "bh" }, { code: "bi" }, { code: "bm" }, { code: "bn" }, { code: "bo" }, 
    { code: "br" }, { code: "bs" }, { code: "ca" }, { code: "ce" }, { code: "ch" }, 
    { code: "co" }, { code: "cr" }, { code: "cs" }, { code: "cu" }, { code: "cv" }, 
    { code: "cy" }, { code: "da" }, { code: "de" }, { code: "dv" }, { code: "dz" }, 
    { code: "ee" }, { code: "el" }, { code: "en" }, { code: "eo" }, { code: "es" }, 
    { code: "et" }, { code: "eu" }, { code: "fa" }, { code: "ff" }, { code: "fi" }, 
    { code: "fj" }, { code: "fo" }, { code: "fr" }, { code: "ga" }, { code: "gd" }, 
    { code: "gl" }, { code: "gn" }, { code: "gu" }, { code: "gv" }, { code: "ha" }, 
    { code: "he" }, { code: "hi" }, { code: "ho" }, { code: "hr" }, { code: "ht" }, 
    { code: "hu" }, { code: "hy" }, { code: "hz" }, { code: "ia" }, { code: "id" }, 
    { code: "ie" }, { code: "ig" }, { code: "ii" }, { code: "ik" }, { code: "io" }, 
    { code: "is" }, { code: "it" }, { code: "iu" }, { code: "ja" }, { code: "jv" }, 
    { code: "ka" }, { code: "kk" }, { code: "kl" }, { code: "km" }, { code: "kn" }, 
    { code: "ko" }, { code: "kr" }, { code: "ks" }, { code: "ku" }, { code: "kv" }, 
    { code: "kw" }, { code: "ky" }, { code: "la" }, { code: "lb" }, { code: "lo" }, 
    { code: "lt" }, { code: "lv" }, { code: "mg" }, { code: "mh" }, { code: "ml" }, 
    { code: "mn" }, { code: "mr" }, { code: "ms" }, { code: "mt" }, { code: "my" }, 
    { code: "na" }, { code: "nb" }, { code: "nd" }, { code: "ne" }, { code: "ng" }, 
    { code: "nl" }, { code: "nn" }, { code: "no" }, { code: "nr" }, { code: "nv" }, 
    { code: "ny" }, { code: "oc" }, { code: "oj" }, { code: "om" }, { code: "or" }, 
    { code: "os" }, { code: "pa" }, { code: "pi" }, { code: "pl" }, { code: "ps" }, 
    { code: "pt" }, { code: "qu" }, { code: "rm" }, { code: "rn" }, { code: "ro" }, 
    { code: "ru" }, { code: "rw" }, { code: "se" }, { code: "sg" }, { code: "si" }, 
    { code: "sk" }, { code: "sl" }, { code: "sm" }, { code: "sn" }, { code: "so" }, 
    { code: "sq" }, { code: "sr" }, { code: "ss" }, { code: "st" }, { code: "su" }, 
    { code: "sv" }, { code: "sw" }, { code: "ta" }, { code: "te" }, { code: "tg" }, 
    { code: "th" }, { code: "tk" }, { code: "tl" }, { code: "tn" }, { code: "to" }, 
    { code: "tr" }, { code: "ts" }, { code: "tt" }, { code: "tw" }, { code: "ty" }, 
    { code: "ug" }, { code: "uk" }, { code: "ur" }, { code: "uz" }, { code: "ve" }, 
    { code: "vi" }, { code: "vo" }, { code: "wa" }, { code: "wo" }, { code: "xh" }, 
    { code: "yi" }, { code: "zu" }
  ];
  
async function main() {
    await prisma.language.createMany({
      data: isoLanguageCodes
    })
}
main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })