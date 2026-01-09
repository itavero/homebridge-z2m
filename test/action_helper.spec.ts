import { SwitchActionHelper } from '../src/converters/action_helper';

function simple_single_press(id: string, label: number) {
  return {
    _id: id,
    extension: undefined,
    serviceLabelIndex: label,
    valueSinglePress: id,
    valueDoublePress: undefined,
    valueLongPress: undefined,
  };
}

describe('SwitchActionHelper', () => {
  test('ORVIBO CR11S8UZ', () => {
    const input = [
      'button_1_click',
      'button_1_hold',
      'button_1_release',
      'button_2_click',
      'button_2_hold',
      'button_2_release',
      'button_3_click',
      'button_3_hold',
      'button_3_release',
      'button_4_click',
      'button_4_hold',
      'button_4_release',
    ];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(4);
    for (let x = 1; x <= 4; ++x) {
      expect(result).toContainEqual({
        _id: `button_${x}`,
        extension: undefined,
        serviceLabelIndex: x,
        valueSinglePress: `button_${x}_click`,
        valueDoublePress: undefined,
        valueLongPress: `button_${x}_hold`,
      });
    }
  });

  test('ORVIBO SE21', () => {
    const input = ['off', 'single', 'double', 'hold'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      _id: undefined,
      extension: undefined,
      serviceLabelIndex: 1,
      valueSinglePress: 'single',
      valueDoublePress: 'double',
      valueLongPress: 'hold',
    });
    expect(result).toContainEqual(simple_single_press('off', 2));
  });

  test('EcoDim ED-10012', () => {
    const input = [
      'on_1',
      'off_1',
      'brightness_move_up_1',
      'brightness_move_down_1',
      'brightness_stop_1',
      'on_2',
      'off_2',
      'brightness_move_up_2',
      'brightness_move_down_2',
      'brightness_stop_2',
    ];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(10);
    // All values ending with 1
    expect(result).toContainEqual(simple_single_press('off_1', 10));
    expect(result).toContainEqual(simple_single_press('on_1', 11));
    expect(result).toContainEqual(simple_single_press('brightness_stop_1', 12));
    expect(result).toContainEqual(simple_single_press('brightness_move_down_1', 13));
    expect(result).toContainEqual(simple_single_press('brightness_move_up_1', 14));

    // All values ending with 2
    expect(result).toContainEqual(simple_single_press('off_2', 20));
    expect(result).toContainEqual(simple_single_press('on_2', 21));
    expect(result).toContainEqual(simple_single_press('brightness_stop_2', 22));
    expect(result).toContainEqual(simple_single_press('brightness_move_down_2', 23));
    expect(result).toContainEqual(simple_single_press('brightness_move_up_2', 24));
  });

  test('Aqara wireless switch WXKG11LM', () => {
    const input = ['single', 'double', 'triple', 'quadruple', 'hold', 'release'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      _id: undefined,
      extension: undefined,
      serviceLabelIndex: 1,
      valueSinglePress: 'single',
      valueDoublePress: 'double',
      valueLongPress: 'hold',
    });
    expect(result).toContainEqual({
      _id: undefined,
      extension: 1,
      serviceLabelIndex: 2,
      valueSinglePress: 'triple',
      valueDoublePress: 'quadruple',
      valueLongPress: undefined,
    });
  });

  test('Aqara Opple switch 3 bands', () => {
    const input = [
      'button_1_hold',
      'button_1_release',
      'button_1_single',
      'button_1_double',
      'button_1_triple',
      'button_2_hold',
      'button_2_release',
      'button_2_single',
      'button_2_double',
      'button_2_triple',
      'button_3_hold',
      'button_3_release',
      'button_3_single',
      'button_3_double',
      'button_3_triple',
      'button_4_hold',
      'button_4_release',
      'button_4_single',
      'button_4_double',
      'button_4_triple',
      'button_5_hold',
      'button_5_release',
      'button_5_single',
      'button_5_double',
      'button_5_triple',
      'button_6_hold',
      'button_6_release',
      'button_6_single',
      'button_6_double',
      'button_6_triple',
    ];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(12);
    for (let x = 1; x <= 6; ++x) {
      expect(result).toContainEqual({
        _id: `button_${x}`,
        extension: undefined,
        serviceLabelIndex: x * 10,
        valueSinglePress: `button_${x}_single`,
        valueDoublePress: `button_${x}_double`,
        valueLongPress: `button_${x}_hold`,
      });
      expect(result).toContainEqual({
        _id: `button_${x}`,
        extension: 1,
        serviceLabelIndex: x * 10 + 1,
        valueSinglePress: `button_${x}_triple`,
      });
    }
  });

  test('TuYa TS0041', () => {
    const input = ['single', 'double', 'hold'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(1);
    expect(result).toContainEqual({
      _id: undefined,
      extension: undefined,
      serviceLabelIndex: 1,
      valueSinglePress: 'single',
      valueDoublePress: 'double',
      valueLongPress: 'hold',
    });
  });

  test('TuYa TS0042', () => {
    const input = ['1_single', '1_double', '1_hold', '2_single', '2_double', '2_hold'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      _id: '1',
      extension: undefined,
      serviceLabelIndex: 1,
      valueSinglePress: '1_single',
      valueDoublePress: '1_double',
      valueLongPress: '1_hold',
    });
    expect(result).toContainEqual({
      _id: '2',
      extension: undefined,
      serviceLabelIndex: 2,
      valueSinglePress: '2_single',
      valueDoublePress: '2_double',
      valueLongPress: '2_hold',
    });
  });

  test('TuYa U86KCJ-ZP', () => {
    const input = ['scene_1', 'scene_2', 'scene_3', 'scene_4', 'scene_5', 'scene_6'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(6);
    expect(result).toContainEqual(simple_single_press('scene_1', 1));
    expect(result).toContainEqual(simple_single_press('scene_2', 2));
    expect(result).toContainEqual(simple_single_press('scene_3', 3));
    expect(result).toContainEqual(simple_single_press('scene_4', 4));
    expect(result).toContainEqual(simple_single_press('scene_5', 5));
    expect(result).toContainEqual(simple_single_press('scene_6', 6));
  });

  test('IKEA TRADFRI open/close remote', () => {
    const input = ['close', 'open', 'stop'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual(simple_single_press('close', 1));
    expect(result).toContainEqual(simple_single_press('open', 2));
    expect(result).toContainEqual(simple_single_press('stop', 3));
  });

  test('OSRAM Smart+ switch mini', () => {
    const input = ['up', 'up_hold', 'up_release', 'down_release', 'down', 'down_hold', 'circle_click', 'circle_release', 'circle_hold'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(3);

    expect(result).toContainEqual({
      _id: 'circle',
      extension: undefined,
      serviceLabelIndex: 1,
      valueSinglePress: 'circle_click',
      valueDoublePress: undefined,
      valueLongPress: 'circle_hold',
    });

    expect(result).toContainEqual({
      _id: 'down',
      extension: undefined,
      serviceLabelIndex: 2,
      valueSinglePress: 'down',
      valueDoublePress: undefined,
      valueLongPress: 'down_hold',
    });

    expect(result).toContainEqual({
      _id: 'up',
      extension: undefined,
      serviceLabelIndex: 3,
      valueSinglePress: 'up',
      valueDoublePress: undefined,
      valueLongPress: 'up_hold',
    });
  });

  test('Sengled Smart switch', () => {
    const input = ['on', 'up', 'down', 'off', 'on_double', 'on_long', 'off_double', 'off_long'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(4);
    expect(result).toContainEqual(simple_single_press('down', 1));
    expect(result).toContainEqual(simple_single_press('up', 4));

    expect(result).toContainEqual({
      _id: 'off',
      extension: undefined,
      serviceLabelIndex: 2,
      valueSinglePress: 'off',
      valueDoublePress: 'off_double',
      valueLongPress: 'off_long',
    });

    expect(result).toContainEqual({
      _id: 'on',
      extension: undefined,
      serviceLabelIndex: 3,
      valueSinglePress: 'on',
      valueDoublePress: 'on_double',
      valueLongPress: 'on_long',
    });
  });

  test('Swann Key fob remote', () => {
    const input = ['home', 'sleep', 'away', 'panic'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(4);
    expect(result).toContainEqual(simple_single_press('away', 1));
    expect(result).toContainEqual(simple_single_press('home', 2));
    expect(result).toContainEqual(simple_single_press('panic', 3));
    expect(result).toContainEqual(simple_single_press('sleep', 4));
  });

  test('Xiaomi WXKG02LM_rev2', () => {
    const input = [
      'single_left',
      'single_right',
      'single_both',
      'double_left',
      'double_right',
      'double_both',
      'hold_left',
      'hold_right',
      'hold_both',
    ];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(3);

    expect(result).toContainEqual({
      _id: 'both',
      extension: undefined,
      serviceLabelIndex: 1,
      valueSinglePress: 'single_both',
      valueDoublePress: 'double_both',
      valueLongPress: 'hold_both',
    });

    expect(result).toContainEqual({
      _id: 'left',
      extension: undefined,
      serviceLabelIndex: 2,
      valueSinglePress: 'single_left',
      valueDoublePress: 'double_left',
      valueLongPress: 'hold_left',
    });

    expect(result).toContainEqual({
      _id: 'right',
      extension: undefined,
      serviceLabelIndex: 3,
      valueSinglePress: 'single_right',
      valueDoublePress: 'double_right',
      valueLongPress: 'hold_right',
    });
  });

  test('Philips Hue Tap with only the supported values', () => {
    const input = ['recall_scene_0', 'recall_scene_1', 'recall_scene_2', 'toggle'];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(4);

    expect(result).toContainEqual(simple_single_press('recall_scene_1', 1));
    expect(result).toContainEqual(simple_single_press('recall_scene_2', 2));
    expect(result).toContainEqual(simple_single_press('recall_scene_0', 3));
    expect(result).toContainEqual(simple_single_press('toggle', 4));
  });

  test('Philips Hue dimmer switch', () => {
    const input = [
      'on-press',
      'on-hold',
      'on-hold-release',
      'up-press',
      'up-hold',
      'up-hold-release',
      'down-press',
      'down-hold',
      'down-hold-release',
      'off-press',
      'off-hold',
      'off-hold-release',
    ];

    const result = SwitchActionHelper.getInstance().valuesToNumberedMappings(input);

    expect(result).toHaveLength(4);

    expect(result).toContainEqual({
      _id: 'down',
      extension: undefined,
      serviceLabelIndex: 1,
      valueSinglePress: 'down-press',
      valueDoublePress: undefined,
      valueLongPress: 'down-hold',
    });

    expect(result).toContainEqual({
      _id: 'off',
      extension: undefined,
      serviceLabelIndex: 2,
      valueSinglePress: 'off-press',
      valueDoublePress: undefined,
      valueLongPress: 'off-hold',
    });

    expect(result).toContainEqual({
      _id: 'on',
      extension: undefined,
      serviceLabelIndex: 3,
      valueSinglePress: 'on-press',
      valueDoublePress: undefined,
      valueLongPress: 'on-hold',
    });

    expect(result).toContainEqual({
      _id: 'up',
      extension: undefined,
      serviceLabelIndex: 4,
      valueSinglePress: 'up-press',
      valueDoublePress: undefined,
      valueLongPress: 'up-hold',
    });
  });
});
