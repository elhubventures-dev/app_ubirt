/**
 * Shared wallet credit logic for payment gateway webhooks.
 */
export async function creditCoinPurchase(supabaseAdmin, {
  reference,
  gateway,
  userId,
  coinsToAdd,
  amount,
  email,
}) {
  const { data: existingTx } = await supabaseAdmin
    .from("transactions")
    .select("id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (existingTx?.status === "success") {
    return { status: "already_processed" };
  }

  let coinsFinal = parseInt(coinsToAdd, 10);
  if (!existingTx) {
    const { count } = await supabaseAdmin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "success");
    if ((count ?? 0) === 0) {
      coinsFinal = Math.floor(coinsFinal * 1.2);
    }
  }

  if (existingTx) {
    const { error: updateErr } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "success",
        amount,
        email: email ?? null,
      })
      .eq("id", existingTx.id);

    if (updateErr) throw updateErr;
  } else {
    const { error: insertErr } = await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      reference,
      gateway,
      amount,
      status: "success",
      coins_added: coinsFinal,
      email: email ?? null,
    });

    if (insertErr) throw insertErr;
  }

  const { data: newBalance, error: coinsErr } = await supabaseAdmin.rpc("add_user_coins", {
    p_user_id: userId,
    p_amount: coinsFinal,
  });

  if (coinsErr) throw coinsErr;

  return { status: "success", newBalance };
}
