use crate::error::EngineError;
use crate::moves;
use crate::types::{Color, PgnHeaders};

pub fn to_pgn_impl(fen: &str, ucis: &[&str], headers: &PgnHeaders) -> Result<String, EngineError> {
    let mut lines: Vec<String> = Vec::new();

    // Headers — order matches pgn-builder.ts exactly
    lines.push(format!("[Event \"{}\"]", headers.event.as_deref().unwrap_or("?")));
    lines.push(format!("[Site \"{}\"]", headers.site.as_deref().unwrap_or("Purechess")));
    lines.push(format!("[Date \"{}\"]", headers.date.as_deref().unwrap_or("????.??.??")));
    lines.push(format!("[White \"{}\"]", headers.white));
    lines.push(format!("[Black \"{}\"]", headers.black));
    lines.push(format!("[Result \"{}\"]", headers.result));
    if let Some(tc) = &headers.time_control {
        lines.push(format!("[TimeControl \"{tc}\"]"));
    }
    if let Some(elo) = headers.white_elo {
        lines.push(format!("[WhiteElo \"{elo}\"]"));
    }
    if let Some(elo) = headers.black_elo {
        lines.push(format!("[BlackElo \"{elo}\"]"));
    }
    if let Some(eco) = &headers.eco {
        lines.push(format!("[ECO \"{eco}\"]"));
    }
    // Blank line separating headers from movetext
    lines.push(String::new());

    if ucis.is_empty() {
        lines.push(headers.result.clone());
        return Ok(lines.join("\n"));
    }

    // Build move list by applying all moves to get SANs and ply data
    let game_state = moves::apply_moves_impl(fen, ucis)?;
    let mut parts: Vec<String> = Vec::new();

    // If first ply is Black, we need the "N..." prefix
    let mut first_black_needs_prefix =
        game_state.moves.first().is_some_and(|p| p.by == Color::Black);

    for ply in &game_state.moves {
        // fullmove = ceil(ply / 2) = (ply + 1) / 2 (integer division)
        let fullmove = ply.ply.div_ceil(2);
        if ply.by == Color::White {
            parts.push(format!("{}. {}", fullmove, ply.san));
            first_black_needs_prefix = false;
        } else if first_black_needs_prefix {
            parts.push(format!("{}... {}", fullmove, ply.san));
            first_black_needs_prefix = false;
        } else {
            parts.push(ply.san.clone());
        }
    }
    parts.push(headers.result.clone());
    lines.push(parts.join(" "));

    Ok(lines.join("\n"))
}
