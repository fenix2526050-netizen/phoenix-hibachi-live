const sitePhone='(516) 518-3325'
const text=v=>String(v??'').trim()
const digits=v=>text(v).replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'')
const moneyFromDollars=v=>`$${Math.max(0,Number(v||0)).toFixed(2)}`
const travelFee=b=>Number(b.travel_fee||0)
const njTollFee=b=>Number(b.nj_toll_fee||0)
const finalTotalDollars=b=>Number(b.final_total||0)
const guestSummary=b=>`${Number(b.guest_count||0)} guests`
function smsSafe(v) {
  return text(v)
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
function smsClip(v, max = 60) {
  const shown = smsSafe(v)
  if (shown.length <= max) return shown
  return `${shown.slice(0, Math.max(0, max - 3)).trimEnd()}...`
}
function smsMoney(v){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Math.max(0,Number(v||0))) }
function smsPhone() {
  const d = digits(sitePhone)
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : smsSafe(sitePhone)
}
function formatSmsDate(v) {
  const raw = text(v)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return smsClip(raw, 22)
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12))
  return new Intl.DateTimeFormat('en-US', {weekday:'short',year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}).format(date)
}
function smsWhen(b) { return smsClip([formatSmsDate(b.event_date), smsSafe(b.event_time)].filter(Boolean).join(' at '), 48) }
function smsLocation(b) {
  const address = smsSafe(b.address || b.event_address)
  if (!address) return ''
  const parts = address.split(',').map(part => part.trim()).filter(Boolean)
  const location = parts.length >= 2 ? parts.slice(-2).join(', ') : address
  return smsClip(location, 38)
}
function smsGuests(b) {
  const total = Math.max(0, Number(b.guest_count || Number(b.adults || 0) + Number(b.kids || 0)))
  return total ? String(total) : smsClip(guestSummary(b), 20)
}
function fitCustomerSms(lines) {
  const footer = [`Questions: ${smsPhone()}`, 'Reply STOP to opt out.']
  let body = lines.map(smsSafe).filter(Boolean)
  const render = () => [...body, ...footer].join('\n')
  if (render().length <= 280) return render()
  for (const prefix of ['Location:', 'Guests:', 'Travel fee:', 'NJ toll:']) {
    const index = body.findIndex(line => line.startsWith(prefix))
    if (index >= 0) body.splice(index, 1)
    if (render().length <= 280) return render()
  }
  const editable = body.findIndex(line => /^(Updated|Reason|Status):/.test(line))
  if (editable >= 0) body[editable] = smsClip(body[editable], 48)
  if (render().length <= 280) return render()
  while (body.length > 4 && render().length > 280) body.splice(body.length - 1, 1)
  if (render().length <= 280) return render()
  const footerText = footer.join('\n')
  const maxBodyLength = Math.max(1, 280 - footerText.length - 1)
  const clippedBody = body.join('\n').slice(0, maxBodyLength).trimEnd()
  return `${clippedBody}\n${footerText}`
}
function detailedSms(eventType,b,c,amountPaid,balanceDue){
 const ref=smsSafe(b.booking_number), when=smsWhen(b), location=smsLocation(b), guests=smsGuests(b)
 const total=smsMoney(finalTotalDollars(b)), balance=smsMoney(balanceDue), travel=smsMoney(travelFee(b)), toll=njTollFee(b)
 switch(eventType){
  case 'booking_confirmed': return fitCustomerSms(['Phoenix Hibachi','BOOKING CONFIRMED',`Order: ${ref}`,when?`Event: ${when}`:'',guests?`Guests: ${guests}`:'',location?`Location: ${location}`:'',`Balance: ${balance}`,'Your date and time are reserved.'])
  case 'deposit_paid': return fitCustomerSms(['Phoenix Hibachi','DEPOSIT RECEIVED',`Order: ${ref}`,`Paid: ${smsMoney(amountPaid)}`,`Balance: ${balance}`,when?`Event: ${when}`:'','Your payment has been applied.'])
  case 'paid_in_full': return fitCustomerSms(['Phoenix Hibachi','PAID IN FULL',`Order: ${ref}`,when?`Event: ${when}`:'','Balance: $0.00','Thank you. Your payment is complete.'])
  case 'booking_rescheduled': return fitCustomerSms(['Phoenix Hibachi','SCHEDULE UPDATED',`Order: ${ref}`,when?`New event: ${when}`:'',location?`Location: ${location}`:'','Please review the updated date and time.'])
  case 'booking_cancelled': return fitCustomerSms(['Phoenix Hibachi','BOOKING CANCELLED',`Order: ${ref}`,`Reason: ${smsClip(c.lead.replace(`Booking ${ref} has been cancelled.`, ''),72)}`,'Contact us with any questions.'])
  case 'booking_modified': { const changed=smsClip((c.lead.match(/Updated:\s*(.+)$/)?.[1]||'').replace(/\.$/,''),58); return fitCustomerSms(['Phoenix Hibachi','ORDER UPDATED',`Order: ${ref}`,when?`Event: ${when}`:'',changed?`Updated: ${changed}`:'',`Total: ${total}`,`Balance: ${balance}`,'Please review your updated email.']) }
  case 'event_reminder_72h': return fitCustomerSms(['Phoenix Hibachi','72-HOUR REMINDER',`Order: ${ref}`,when?`Event: ${when}`:'',guests?`Guests: ${guests}`:'',location?`Location: ${location}`:'','Please confirm access, parking, weather backup, and final guest count.'])
  default: return fitCustomerSms(['Phoenix Hibachi','REQUEST RECEIVED',`Order: ${ref}`,when?`Event: ${when}`:'',guests?`Guests: ${guests}`:'',location?`Location: ${location}`:'',`Travel fee: ${travel}`,toll>0?`NJ toll: ${smsMoney(toll)}`:'',`Estimated total: ${total}`,'Status: Pending review - not confirmed yet.'])
 }
}
const sample={booking_number:'PHX-260721-RLYF',event_date:'2026-07-24',event_time:'5:30 PM',guest_count:14,address:'602 Quincy Street, Brooklyn, NY 11221',travel_fee:50,final_total:1224.84,nj_toll_fee:0}
const events=['booking_request_received','booking_confirmed','deposit_paid','paid_in_full','booking_rescheduled','booking_cancelled','booking_modified','event_reminder_72h']
for(const event of events){
 const c={lead:event==='booking_cancelled'?`Booking ${sample.booking_number} has been cancelled. Customer requested a different date.`:event==='booking_modified'?`Booking ${sample.booking_number} was updated from Admin dashboard. Updated: Adults, children, package, protein selections.`:''}
 const out=detailedSms(event,sample,c,200,event==='paid_in_full'?0:1024.84)
 if(out.length>280) throw new Error(`${event} exceeds 280: ${out.length}`)
 if(!out.endsWith('Reply STOP to opt out.')) throw new Error(`${event} missing STOP footer`)
 if(/[^\x0A\x20-\x7E]/.test(out)) throw new Error(`${event} contains non-ASCII`)
 if(!out.includes('\n')) throw new Error(`${event} missing line breaks`)
 if(out.includes('booking_request_received')) throw new Error('raw event type leaked')
 console.log(`\n--- ${event} (${out.length} chars) ---\n${out}`)
}
const request=detailedSms('booking_request_received',sample,{lead:''},0,1224.84)
if(request.includes('Balance Due')) throw new Error('request receipt should not show misleading duplicate balance')
if(!request.includes('Pending review - not confirmed yet.')) throw new Error('pending disclaimer missing')
console.log('\nAll SMS V243 checks passed.')
