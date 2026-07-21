import { query } from "@/lib/db";

export async function getMokaToken() {
    try {
        const result = await query('SELECT * FROM moka_tokens ORDER BY id DESC LIMIT 1');
        return result.rows[0] || null;
    } catch (error) {
        console.error("Error fetching Moka token:", error);
        return null;
    }
}

export async function saveMokaToken(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    scope: string,
    mokaCreatedAt: number
) {
    try {
        await query(`
            INSERT INTO moka_tokens (access_token, refresh_token, expires_in, scope, moka_created_at)
            VALUES ($1, $2, $3, $4, $5)
        `, [accessToken, refreshToken, expiresIn, scope, mokaCreatedAt]);
        return true;
    } catch (error) {
        console.error("Error saving Moka token:", error);
        return false;
    }
}

export async function deleteMokaTokens() {
    try {
        await query('DELETE FROM moka_tokens');
        return true;
    } catch (error) {
        console.error("Error deleting Moka tokens:", error);
        return false;
    }
}
