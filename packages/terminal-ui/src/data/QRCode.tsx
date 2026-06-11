/** @jsxImportSource @sigx/runtime-core */
import { component, type Define } from '@sigx/runtime-core';
import { generateQR } from '@sigx/terminal-zero';

/**
 * A scannable QR code rendered with half-block characters (two QR rows per
 * terminal row). A typical URL fits in ~15 rows × ~29 columns.
 *
 * Deliberately NOT themed: a QR code needs maximum contrast for camera
 * scanners, so it always renders in the terminal's default foreground on its
 * default background. `invert` swaps dark/light for terminals or scanners
 * that disagree about which is which; modern scanners decode both.
 */
export const QRCode = component<
    Define.Prop<'text', string, true> &
    Define.Prop<'invert', boolean, false> &
    Define.Prop<'quiet', number, false>
>(({ props }) => {
    return () => {
        const rows = generateQR(props.text ?? '', {
            invert: props.invert ?? false,
            quiet: props.quiet,
        }).split('\n');
        return (
            <box>
                {rows.flatMap((line, i) => {
                    const node = <text>{line}</text>;
                    return i > 0 ? [<br />, node] : [node];
                })}
            </box>
        );
    };
}, { name: 'QRCode' });

export default QRCode;
