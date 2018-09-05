// @flow

import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  findNodeHandle,
} from 'react-native';

const { width } = Dimensions.get('window');

type Props = {
  /**
   * A handler to be called when array of tags change
   */
    onChange: (items: Array<any>) => void,
  /**
   * A handler to be called when the text value of the TextInput changes
   */
    onTextChange: (text: string) => void,
  /**
   * An array of tags
   */
    value: Array<any>,
  /**
   * An array os characters to use as tag separators
   */
    separators: Array<string>,
  /**
   * A RegExp to test tags after enter, space, or a comma is pressed
   */
    regex?: Object,
  /**
   * Background color of tags
   */
    tagColor?: string,
  /**
   * Text color of tags
   */
    tagTextColor?: string,
  /**
   * Styling override for container surrounding tag text
   */
    tagContainerStyle?: Object,
  /**
   * Styling overrride for tag's text component
   */
    tagTextStyle?: Object,
  /**
   * Color of text input
   */
    inputColor?: string,
  /**
   * TextInput props Text.propTypes
   */
    inputProps?: Object,
  /**
   * Styling overrride for textInput's text
   */
    inputTextStyle?: Object,
  /**
   * Styling overrride for textInput's placeholder text
   */
    placeholder?: string,
  /**
   * Styling overrride for textInput's placeholder text color
   */
    placeholderTextColor?: string,
  /**
   * path of the label in tags objects
   */
    labelKey?: string,
  /**
   *  maximum number of lines of this component
   */
    numberOfLines: number,
  /**
   * The style of each line, {height: number, marginBottom: number}
   */
    lineStyle: Object,
  /**
   * Render method to override the given tag render.  Tag property can be either a string or an Object (if you are using the labelKey).
   */
   renderTag?: (props: Object, index: number, tag: *) => React.Element,
};

type State = {
  text: string,
  inputWidth: ?number,
  lines: number,
};

type NativeEvent = {
  target: number,
  key: string,
  eventCount: number,
  text: string,
};

type Event = {
  nativeEvent: NativeEvent,
};

const DEFAULT_SEPARATORS = [',', ' ', ';', '\n'];
const DEFAULT_TAG_REGEX = /(.+)/gi

class TagInput extends Component {
  static propTypes = {
    onChange: PropTypes.func.isRequired,
    value: PropTypes.array.isRequired,
    regex: PropTypes.object,
    tagColor: PropTypes.string,
    tagTextColor: PropTypes.string,
    inputColor: PropTypes.string,
    inputProps: PropTypes.object,
    inputTextStyle: PropTypes.object,
    placeholder: PropTypes.string,
    placeholderTextColor: PropTypes.string,
    labelKey: PropTypes.string,
    numberOfLines: PropTypes.number,
    lineStyle: PropTypes.object,
    renderTag: PropTypes.func,
  };

  props: Props;
  state: State = {
    text: '',
    inputWidth: null,
    lines: 1,
  };

  wrapperWidth = width;
  totalLines = 1;

  // scroll to bottom
  contentHeight: 0;
  scrollViewHeight: 0;

  static defaultProps = {
    tagColor: '#dddddd',
    tagTextColor: '#777777',
    inputColor: '#777777',
    numberOfLines: 2,
    lineStyle: {height: 40, marginBottom: 0},
    inputTextStyle: {
      height: 36,
      fontSize: 16,
      flex: .6,
      marginBottom: 6,
      padding: 0,
    },
  };

  measureWrapper = () => {
    if (!this.refs.wrapper)
      return;

    this.refs.wrapper.measureLayout(findNodeHandle(this.refs.touchable), (ox, oy, w, /*h, px, py*/) => {
      this.wrapperWidth = Math.floor(w);
      if (this.state.inputWidth <= 0 && this.state.inputWidth != this.wrapperWidth) {
        this.setState({ inputWidth: this.wrapperWidth });
      }
    });
  };

  calculateMeasures = () => {
    setTimeout(() => {
      if (!this.refs['tag' + (this.props.value.length - 1)] || !this.refs.tagContainer)
        return;

      this.refs['tag' + (this.props.value.length - 1)].measureLayout(findNodeHandle(this.refs.tagContainer), (tagX, tagY, tagWidth, /*tagHeight, tagPX, tagPy*/) => {
        const endPosOfTag = tagWidth + tagX;
        const margin = 3;
        const spaceLeft = this.wrapperWidth - endPosOfTag - margin - 10;
        const inputWidth = (spaceLeft < 100) ? this.wrapperWidth : spaceLeft - 10;
        const lineHeight = this.props.lineStyle.height;

        const oldTotalLines = this.totalLines;
        this.totalLines = Math.floor((tagY + lineHeight) / lineHeight);

        let lines = Math.min(this.totalLines, this.props.numberOfLines);
        let completion = () => {};

        if (spaceLeft < 100) {
          this.totalLines = this.totalLines + 1;
          if (lines < this.props.numberOfLines) {
            lines = lines + 1;
          } else {
            completion = ():* => this.scrollToBottom();
          }
        }

        if (oldTotalLines > this.totalLines) {
          completion = ():* => {
            if (this.totalLines * lineHeight > this.scrollViewHeight) {
              this.refs.scrollView.scrollTo({
                y: (this.totalLines * lineHeight) + this.props.lineStyle.marginBottom - this.scrollViewHeight,
                animated: true,
              });
            } else {
              this.refs.scrollView.scrollTo({
                y: 0, animated: true,
              });
            }
          };
        }

        this.setState({
          inputWidth: inputWidth,
          lines: lines,
        }, completion);
      });
    }, 0);
  };

  componentDidMount() {
    setTimeout(() => {
      this.calculateMeasures();
    }, 100);
  }

  componentDidUpdate(prevProps: Props, /*prevState*/) {
    if (prevProps.value.length != this.props.value.length || !prevProps.value) {
      this.calculateMeasures();
    }
  }

  onChange = (event: Event) => {
    if (!event || !event.nativeEvent)
      return;

    const text = event.nativeEvent.text;
    if (this.props.onTextChange) {
      this.props.onTextChange(text);
    }
    this.setState({ text: text });
    const lastTyped = text.charAt(text.length - 1);

    const parseWhen = this.props.separators || DEFAULT_SEPARATORS;

    if (parseWhen.indexOf(lastTyped) > -1)
      this.parseTags();
  };

  onBlur = (event: Event) => {
    if (!event || !event.nativeEvent || !this.props.parseOnBlur)
      return;

    const text = event.nativeEvent.text;
    this.setState({ text: text });
    this.parseTags();
  };

  onContentSizeChange = (width: number, height: number) => {
    this.contentHeight = height;
  };

  parseTags = () => {
    const { text } = this.state;
    const { value } = this.props;

    const regex = this.props.regex || DEFAULT_TAG_REGEX;
    const results = text.match(regex);

    if (results && results.length > 0) {
      this.setState({ text: '' });
      this.props.onChange([...new Set([...value, ...results])]);
    }
  };

  onKeyPress = (event: Event) => {
    if (this.state.text === '' && event.nativeEvent && event.nativeEvent.key == 'Backspace') {
      this.pop();
    }
  };

  focus = () => {
    if (this.refs.tagInput)
      this.refs.tagInput.focus();
  };

  pop = () => {
    const tags = [...this.props.value];
    tags.pop();
    this.props.onChange(tags);
    this.focus();
  };

  removeIndex = (index: number) => {
    const tags = [...this.props.value];
    tags.splice(index, 1);
    this.props.onChange(tags);
    this.focus();
  };

  _getLabelValue = (tag) => {
    const { labelKey } = this.props;

    if (labelKey) {
      if (labelKey in tag) {
        return tag[labelKey];
      }
    }

    return tag;
  };

  _renderTag = (tag, index) => {
    if (this.props.renderTag) {
      return this.props.renderTag(this.props, index, this._getLabelValue(tag));
    }
    const { tagColor, tagTextColor } = this.props;

    return (
      <TouchableOpacity
        key={index}
        ref={'tag' + index}
        style={[styles.tag, { backgroundColor: tagColor }, this.props.tagContainerStyle]}
        onPress={() => this.removeIndex(index)}>
        <Text style={[styles.tagText, { color: tagTextColor }, this.props.tagTextStyle]}>
          {this._getLabelValue(tag)}&nbsp;&times;
        </Text>
      </TouchableOpacity>
    );
  };

  scrollToBottom = (animated: boolean = true) => {
    if (this.contentHeight > this.scrollViewHeight) {
      this.refs.scrollView.scrollTo({
        y: this.contentHeight + this.props.lineStyle.marginBottom - this.scrollViewHeight,
        animated,
      });
    }
  };

  render() {
    const { text, inputWidth, lines } = this.state;
    const { value, inputColor } = this.props;

    const defaultInputProps = {
      autoCapitalize: 'none',
      autoCorrect: false,
      placeholder: 'Start typing',
      returnKeyType: 'done',
      keyboardType: 'default',
      underlineColorAndroid: 'rgba(0,0,0,0)',
    }

    const inputProps = { ...defaultInputProps, ...this.props.inputProps };

    const wrapperHeight = lines * (this.props.lineStyle.height + (this.props.lineStyle.marginBottom / 2)) + this.props.lineStyle.marginBottom;

    const textInputWidth = inputWidth ? inputWidth : width;

    return (
      <TouchableWithoutFeedback
        onPress={() => this.refs.tagInput.focus()}
        ref={"touchable"}
        onLayout={this.measureWrapper}>
        <View
          style={[styles.wrapper, this.props.style, {height: wrapperHeight}]}
          ref="wrapper"
          onLayout={this.measureWrapper}>
          <ScrollView
            ref='scrollView'
            style={styles.tagInputContainerScroll}
            onContentSizeChange={this.onContentSizeChange}
            onLayout={ev => this.scrollViewHeight = ev.nativeEvent.layout.height}
          >
            <View style={styles.tagInputContainer}
                  ref={'tagContainer'}>
              {value.map((tag, index) => this._renderTag(tag, index))}
              <View style={{ width: this.state.inputWidth, height: this.props.lineStyle.height}}>
                <TextInput
                  ref="tagInput"
                  blurOnSubmit={false}
                  allowFontScaling={false}
                  onKeyPress={this.onKeyPress}
                  value={text}
                  placeholder={this.props.placeholder}
                  placeholderTextColor={this.props.placeholderTextColor}
                  style={[this.props.inputTextStyle, {
                  width: textInputWidth,
                  color: inputColor,
                }]}
                  onBlur={this.onBlur}
                  onChange={this.onChange}
                  onSubmitEditing={this.parseTags}
                  {...inputProps}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    )
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginTop: 3,
    marginBottom: 2,
    alignItems: 'flex-start',
  },
  tagInputContainerScroll: {
    flex: 1,
  },
  tagInputContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    justifyContent: 'center',
    marginTop: 6,
    marginRight: 3,
    padding: 8,
    height: 24,
    borderRadius: 2,
  },
  tagText: {
    padding: 0,
    margin: 0,
  },
});

export default TagInput;

export { DEFAULT_SEPARATORS, DEFAULT_TAG_REGEX }
